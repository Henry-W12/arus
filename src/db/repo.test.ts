import { beforeEach, describe, expect, it } from 'vitest';
import { clearDb } from '../test/fixtures';
import { periodByKey } from '../lib/period';
import { periodTotals } from '../lib/summary';
import { db } from './db';
import {
  addTransaction,
  addTransfer,
  adjustBalance,
  archiveAccount,
  archiveCategory,
  createAccount,
  createCategory,
  createRecurring,
  createTemplate,
  deleteAccount,
  deleteCategory,
  deleteRecurring,
  deleteTransaction,
  getAccountBalance,
  getSettings,
  pauseRecurring,
  countMissedOccurrences,
  resetAllData,
  restoreTransaction,
  resumeRecurring,
  runRecurring,
  setBudget,
  setSetting,
  updateAccount,
  updateRecurring,
  updateTransaction,
  applyTemplate,
} from './repo';
import type { Account, Category } from './schema';
import { ensureSeeded } from './seed';

let tunai: Account;
let bank: Account;
let ewallet: Account;
let makan: Category;
let gaji: Category;

beforeEach(async () => {
  await clearDb();
  await ensureSeeded();
  const accounts = await db.accounts.orderBy('sortOrder').toArray();
  [tunai, bank, ewallet] = accounts;
  const cats = await db.categories.toArray();
  makan = cats.find((c) => c.name === 'Makan & Minum')!;
  gaji = cats.find((c) => c.name === 'Gaji')!;
});

describe('seed', () => {
  it('akun & kategori default, idempoten', async () => {
    expect((await db.accounts.orderBy('sortOrder').toArray()).map((a) => a.name)).toEqual(['Tunai', 'Rekening Bank', 'E-Wallet']);
    const expense = await db.categories.where('kind').equals('expense').sortBy('sortOrder');
    expect(expense).toHaveLength(12);
    expect(expense[0]).toMatchObject({ name: 'Makan & Minum', icon: 'utensils', color: 'c1' });
    expect(await db.categories.where('kind').equals('income').count()).toBe(6);
    expect(await db.transactions.count()).toBe(0);
    expect(await ensureSeeded()).toBe(false);
    expect(await db.accounts.count()).toBe(3);
    expect((await getSettings()).lastAccountId).toBe(tunai.id);
  });
});

describe('transaksi', () => {
  it('AC-IN-02 simpan expense + lastAccountId diperbarui; AC-IN-03 urungkan', async () => {
    const tx = await addTransaction({ type: 'expense', amount: 25_000, date: '2026-11-20', accountId: bank.id, categoryId: makan.id });
    expect(tx).toMatchObject({ type: 'expense', amount: 25_000, date: '2026-11-20' });
    expect((await getSettings()).lastAccountId).toBe(bank.id);
    expect(await getAccountBalance(bank.id, '2026-11-20')).toBe(-25_000);
    await deleteTransaction(tx.id);
    expect(await getAccountBalance(bank.id, '2026-11-20')).toBe(0);
  });

  it('AC-LS-03 urungkan hapus memasukkan record identik', async () => {
    const tx = await addTransaction({ type: 'income', amount: 100, date: '2026-11-20', accountId: tunai.id, categoryId: gaji.id, note: '  bonus  ' });
    expect(tx.note).toBe('bonus');
    const removed = await deleteTransaction(tx.id);
    await restoreTransaction(removed!);
    expect(await db.transactions.get(tx.id)).toEqual(tx);
  });

  it('AC-LS-04 edit: updatedAt berubah, createdAt tetap, field dihapus saat ganti jenis', async () => {
    const tx = await addTransaction({ type: 'expense', amount: 10_000, date: '2026-11-20', accountId: tunai.id, categoryId: makan.id });
    const edited = await updateTransaction(tx.id, { amount: 12_000 });
    expect(edited.createdAt).toBe(tx.createdAt);
    expect(edited.updatedAt).toBeGreaterThan(tx.updatedAt);
    const asTransfer = await updateTransaction(tx.id, { type: 'transfer', categoryId: undefined, toAccountId: bank.id });
    expect(asTransfer.categoryId).toBeUndefined();
    expect(asTransfer.toAccountId).toBe(bank.id);
  });

  it('validasi: kategori wajib, jenis kategori sesuai, nominal integer, akun arsip ditolak', async () => {
    const base = { date: '2026-11-20', accountId: tunai.id };
    await expect(addTransaction({ ...base, type: 'expense', amount: 1 })).rejects.toThrow('Kategori wajib diisi');
    await expect(addTransaction({ ...base, type: 'expense', amount: 1, categoryId: gaji.id })).rejects.toThrow('Jenis kategori');
    await expect(addTransaction({ ...base, type: 'expense', amount: 1.5, categoryId: makan.id })).rejects.toThrow('Nominal');
    await expect(addTransaction({ ...base, type: 'expense', amount: 1e12, categoryId: makan.id })).rejects.toThrow('Nominal');
    await expect(addTransfer({ fromAccountId: tunai.id, toAccountId: tunai.id, amount: 5, date: '2026-11-20' })).rejects.toThrow('sama');
    await archiveAccount(ewallet.id);
    await expect(addTransaction({ ...base, accountId: ewallet.id, type: 'expense', amount: 1, categoryId: makan.id })).rejects.toThrow('diarsipkan');
  });

  it('AC-AC-02 transfer: saldo pindah, total & ringkasan tetap', async () => {
    await updateAccount(tunai.id, { openingBalance: 500_000 });
    await addTransfer({ fromAccountId: tunai.id, toAccountId: bank.id, amount: 200_000, date: '2026-11-20' });
    expect(await getAccountBalance(tunai.id, '2026-11-20')).toBe(300_000);
    expect(await getAccountBalance(bank.id, '2026-11-20')).toBe(200_000);
    expect(periodTotals(await db.transactions.toArray(), periodByKey('2026-11', 1))).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('AC-AC-04 sesuaikan saldo membuat adjustment \u221212.500', async () => {
    await updateAccount(tunai.id, { openingBalance: 300_000 });
    const adj = await adjustBalance(tunai.id, 287_500, '2026-11-20');
    expect(adj).toMatchObject({ type: 'adjustment', amount: -12_500, note: 'Penyesuaian saldo', date: '2026-11-20' });
    expect(await getAccountBalance(tunai.id, '2026-11-20')).toBe(287_500);
    expect(await adjustBalance(tunai.id, 287_500, '2026-11-20')).toBeNull();
  });
});

describe('akun & kategori', () => {
  it('AC-AC-06 nama duplikat ditolak (case-insensitive), akun terakhir tidak bisa diarsipkan', async () => {
    await expect(createAccount({ name: ' tunai ', type: 'cash', icon: 'cash', color: 'c1', openingBalance: 0, includeInTotal: 1 })).rejects.toThrow(
      'Nama sudah dipakai',
    );
    await archiveAccount(bank.id);
    await archiveAccount(ewallet.id);
    await expect(archiveAccount(tunai.id)).rejects.toMatchObject({ code: 'last-active' });
  });

  it('AC-AC-05 akun dengan transaksi tidak bisa dihapus; tanpa transaksi boleh', async () => {
    await addTransaction({ type: 'expense', amount: 1, date: '2026-11-20', accountId: bank.id, categoryId: makan.id });
    await expect(deleteAccount(bank.id)).rejects.toMatchObject({ code: 'has-transactions' });
    await deleteAccount(ewallet.id);
    expect(await db.accounts.get(ewallet.id)).toBeUndefined();
  });

  it('arsip akun menonaktifkan aturan berulang & memperbaiki akun default', async () => {
    await setSetting('defaultAccount', bank.id);
    await addTransaction({ type: 'expense', amount: 1, date: '2026-11-20', accountId: bank.id, categoryId: makan.id });
    await createRecurring({ type: 'expense', amount: 5, accountId: bank.id, categoryId: makan.id, frequency: 'monthly', interval: 1, anchorDate: '2026-12-01' }, '2026-11-20');
    expect(await archiveAccount(bank.id)).toEqual({ deactivatedRules: 1 });
    const s = await getSettings();
    expect(s.defaultAccount).toBe('last');
    expect(s.lastAccountId).toBe(tunai.id);
  });

  it('kategori: tambah di urutan akhir, arsip item terakhir ditolak, hapus beserta anggaran', async () => {
    const kopi = await createCategory({ kind: 'expense', name: 'Kopi', icon: 'coffee', color: 'c1' });
    expect(kopi.sortOrder).toBe(12);
    await setBudget(kopi.id, '2026-11', 100_000);
    await deleteCategory(kopi.id);
    expect(await db.budgets.count()).toBe(0);
    const incomes = await db.categories.where('kind').equals('income').toArray();
    for (const c of incomes.slice(1)) await archiveCategory(c.id);
    await expect(archiveCategory(incomes[0].id)).rejects.toMatchObject({ code: 'last-active' });
  });
});

describe('anggaran', () => {
  it('AC-BG-04 upsert per [kategori+periode]', async () => {
    await setBudget(makan.id, '2026-10', 1_000_000);
    await setBudget(makan.id, '2026-11', 1_500_000);
    await setBudget(makan.id, '2026-11', 1_600_000);
    const rows = await db.budgets.where('categoryId').equals(makan.id).sortBy('startPeriod');
    expect(rows.map((b) => [b.startPeriod, b.amount])).toEqual([
      ['2026-10', 1_000_000],
      ['2026-11', 1_600_000],
    ]);
    await expect(setBudget(gaji.id, '2026-11', 1)).rejects.toThrow('pengeluaran');
  });
});

describe('runRecurring', () => {
  const monthly = () => ({
    type: 'expense' as const,
    amount: 1_500_000,
    accountId: tunai.id,
    categoryId: makan.id,
    note: 'Kos',
    frequency: 'monthly' as const,
    interval: 1,
  });

  it('AC-RC-07 dibuat hari ini → tepat 1 transaksi + generatedCount=1', async () => {
    const { rule, run } = await createRecurring({ ...monthly(), anchorDate: '2026-11-20' }, '2026-11-20');
    expect(run.created).toBe(1);
    expect(rule).toMatchObject({ generatedCount: 1, nextDate: '2026-12-20', active: 1 });
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ date: '2026-11-20', recurringId: rule.id, note: 'Kos', amount: 1_500_000 });
  });

  it('AC-RC-02/03 catch-up lalu idempoten (run 2× tanpa duplikat, juga paralel)', async () => {
    const { rule } = await createRecurring({ ...monthly(), anchorDate: '2026-11-01' }, '2026-10-31');
    const [a, b] = await Promise.all([runRecurring('2026-12-03'), runRecurring('2026-12-03')]);
    expect(a.created + b.created).toBe(2);
    expect((await runRecurring('2026-12-03')).created).toBe(0);
    const dates = (await db.transactions.where('recurringId').equals(rule.id).toArray()).map((t) => t.date).sort();
    expect(dates).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('AC-RC-04 transaksi hasil generate yang dihapus tidak dibuat ulang', async () => {
    const { run } = await createRecurring({ ...monthly(), anchorDate: '2026-11-01' }, '2026-11-20');
    await deleteTransaction(run.transactionIds[0]);
    expect((await runRecurring('2026-11-25')).created).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('AC-RC-01 clamp akhir bulan saat catch-up', async () => {
    await createRecurring({ ...monthly(), anchorDate: '2027-01-31' }, '2027-04-30');
    const dates = (await db.transactions.toArray()).map((t) => t.date).sort();
    expect(dates).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('AC-RC-05 endDate → nonaktif', async () => {
    const { rule } = await createRecurring({ ...monthly(), anchorDate: '2026-09-01', endDate: '2026-10-15' }, '2026-11-20');
    expect(await db.transactions.count()).toBe(2);
    expect(rule.active).toBe(0);
  });

  it('AC-RC-08 harian 2 tahun → 400 per run', async () => {
    const { run } = await createRecurring({ ...monthly(), frequency: 'daily', anchorDate: '2024-11-20' }, '2026-11-20');
    expect(run.created).toBe(400);
    expect((await runRecurring('2026-11-20')).created).toBe(331);
    expect((await runRecurring('2026-11-20')).created).toBe(0);
  });

  it('AC-RC-10 akun diarsipkan → aturan nonaktif, tidak ada transaksi baru', async () => {
    const { rule } = await createRecurring({ ...monthly(), accountId: bank.id, anchorDate: '2026-12-01' }, '2026-11-20');
    await db.accounts.update(bank.id, { archived: 1 });
    expect((await runRecurring('2026-12-05')).created).toBe(0);
    expect((await db.recurring.get(rule.id))?.active).toBe(0);
  });

  it('AC-RC-09 jeda lalu aktifkan: catat yang terlewat vs lewati', async () => {
    const { rule } = await createRecurring({ ...monthly(), anchorDate: '2026-08-01' }, '2026-08-01');
    await pauseRecurring(rule.id);
    expect((await runRecurring('2026-11-20')).created).toBe(0);
    expect(await countMissedOccurrences(rule.id, '2026-11-20')).toBe(3);
    const r = await resumeRecurring(rule.id, 'catch-up', '2026-11-20');
    expect(r.created).toBe(3);

    const { rule: r2 } = await createRecurring({ ...monthly(), note: 'Netflix', anchorDate: '2026-08-05' }, '2026-08-05');
    await pauseRecurring(r2.id);
    expect((await resumeRecurring(r2.id, 'skip', '2026-11-20')).created).toBe(0);
    expect(await db.recurring.get(r2.id)).toMatchObject({ active: 1, generatedCount: 4, nextDate: '2026-12-05' });
  });

  it('ubah jadwal → generatedCount reset dari anchor baru; transaksi lama tetap', async () => {
    const { rule } = await createRecurring({ ...monthly(), anchorDate: '2026-11-01' }, '2026-11-20');
    const { rule: updated, run } = await updateRecurring(rule.id, { anchorDate: '2026-11-15' }, '2026-11-20');
    expect(run.created).toBe(1);
    expect(updated).toMatchObject({ generatedCount: 1, nextDate: '2026-12-15' });
    expect(await db.transactions.count()).toBe(2);
    const { run: run2 } = await updateRecurring(rule.id, { amount: 2_000_000 }, '2026-11-20');
    expect(run2.created).toBe(0);
  });

  it('hapus aturan: transaksi tetap, opsional hapus yang bertanggal masa depan', async () => {
    const { rule, run } = await createRecurring({ ...monthly(), anchorDate: '2026-11-01' }, '2026-11-20');
    await updateTransaction(run.transactionIds[0], { date: '2026-12-31' });
    await addTransaction({ type: 'expense', amount: 1, date: '2026-11-02', accountId: tunai.id, categoryId: makan.id, recurringId: rule.id });
    await deleteRecurring(rule.id, { deleteFuture: true, today: '2026-11-20' });
    expect(await db.recurring.count()).toBe(0);
    expect((await db.transactions.toArray()).map((t) => t.date)).toEqual(['2026-11-02']);
  });
});

describe('favorit', () => {
  it('AC-IN-11 pakai favorit = simpan instan + useCount++; AC-CT-05 maks 12', async () => {
    const t = await createTemplate({ label: 'Kopi', type: 'expense', amount: 25_000, categoryId: makan.id, note: 'Kopi' });
    await setSetting('lastAccountId', bank.id);
    const tx = await applyTemplate(t.id, '2026-11-20');
    expect(tx).toMatchObject({ amount: 25_000, accountId: bank.id, categoryId: makan.id, date: '2026-11-20', note: 'Kopi' });
    expect((await db.templates.get(t.id))?.useCount).toBe(1);
    for (let i = 1; i < 12; i++) await createTemplate({ label: `F${i}`, type: 'expense', amount: 1, categoryId: makan.id });
    await expect(createTemplate({ label: 'F13', type: 'expense', amount: 1, categoryId: makan.id })).rejects.toMatchObject({ code: 'limit-reached' });
  });
});

describe('hapus semua data', () => {
  it('AC-BK-09 / AC-PN-05 kosongkan termasuk PIN lalu seed ulang', async () => {
    await addTransaction({ type: 'expense', amount: 1, date: '2026-11-20', accountId: tunai.id, categoryId: makan.id });
    await setSetting('pin', { hash: 'h', salt: 's', iterations: 1 });
    await resetAllData();
    expect(await db.transactions.count()).toBe(0);
    expect(await db.accounts.count()).toBe(3);
    expect((await getSettings()).pin).toBeNull();
  });
});
