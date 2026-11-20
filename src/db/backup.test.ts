import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBackup, serializeBackup } from '../lib/backup';
import { computeBalances } from '../lib/balances';
import { clearDb } from '../test/fixtures';
import { createBackup, createCsvFile, markBackupDone, previewRestore, readAllData, restoreBackup } from './backup';
import { db } from './db';
import { addTransaction, addTransfer, createRecurring, createTemplate, getSettings, resetAllData, setBudget, setSetting } from './repo';
import { ensureSeeded } from './seed';

async function populate() {
  const [tunai, bank] = await db.accounts.orderBy('sortOrder').toArray();
  const makan = (await db.categories.toArray()).find((c) => c.name === 'Makan & Minum')!;
  await addTransaction({ type: 'expense', amount: 25_000, date: '2026-11-19', accountId: tunai.id, categoryId: makan.id, note: 'Kopi, "susu"' });
  await addTransfer({ fromAccountId: bank.id, toAccountId: tunai.id, amount: 100_000, date: '2026-11-20' });
  await setBudget(makan.id, '2026-11', 1_000_000);
  await createTemplate({ label: 'Kopi', type: 'expense', amount: 25_000, categoryId: makan.id });
  await createRecurring(
    { type: 'expense', amount: 5, accountId: tunai.id, categoryId: makan.id, frequency: 'monthly', interval: 1, anchorDate: '2026-11-01' },
    '2026-11-20',
  );
  await setSetting('periodStartDay', 25);
}

beforeEach(async () => {
  await clearDb();
  await ensureSeeded();
  await populate();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backup & restore', () => {
  it('AC-BK-02 round-trip: backup → hapus semua → restore = identik, saldo identik', async () => {
    await setSetting('pin', { hash: 'h', salt: 's', iterations: 1 });
    const before = await readAllData();
    const text = serializeBackup(await createBackup());
    expect(text).not.toContain('"hash"');

    await resetAllData();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const preview = await previewRestore(parsed.backup);
    expect(preview.backup.transactions).toBe(3);
    expect(preview.current.transactions).toBe(0);
    await restoreBackup(parsed.backup, '2026-11-20');

    const after = await readAllData();
    const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(byId(after.accounts)).toEqual(byId(before.accounts));
    expect(byId(after.categories)).toEqual(byId(before.categories));
    expect(byId(after.transactions)).toEqual(byId(before.transactions));
    expect(byId(after.budgets)).toEqual(byId(before.budgets));
    expect(byId(after.recurring)).toEqual(byId(before.recurring));
    expect(byId(after.templates)).toEqual(byId(before.templates));
    expect((await getSettings()).periodStartDay).toBe(25);
    expect(computeBalances(after.accounts, after.transactions)).toEqual(computeBalances(before.accounts, before.transactions));
  });

  it('PIN perangkat dipertahankan saat restore', async () => {
    const backup = await createBackup();
    await setSetting('pin', { hash: 'h', salt: 's', iterations: 1 });
    await restoreBackup(backup, '2026-11-20');
    expect((await getSettings()).pin).toEqual({ hash: 'h', salt: 's', iterations: 1 });
  });

  it('AC-BK-05 gagal di tengah restore (throw di bulkAdd) → data lama utuh', async () => {
    const backup = await createBackup();
    backup.data.transactions = [];
    const before = await readAllData();
    vi.spyOn(db.transactions, 'bulkAdd').mockImplementation(() => {
      throw new Error('disk penuh');
    });
    await expect(restoreBackup(backup, '2026-11-20')).rejects.toThrow('disk penuh');
    vi.restoreAllMocks();
    expect(await readAllData()).toEqual(before);
  });

  it('restore gagal karena constraint (id ganda lolos ke DB) juga rollback', async () => {
    const backup = await createBackup();
    const before = await readAllData();
    backup.data.categories.push({ ...backup.data.categories[0] });
    await expect(restoreBackup(backup, '2026-11-20')).rejects.toThrow();
    expect(await readAllData()).toEqual(before);
  });

  it('restore menjalankan runRecurring setelahnya', async () => {
    const backup = await createBackup();
    const result = await restoreBackup(backup, '2026-12-02');
    expect(result.created).toBe(1);
  });

  it('markBackupDone menyimpan lastBackupAt & jumlah transaksi', async () => {
    await markBackupDone(1234);
    const s = await getSettings();
    expect(s.lastBackupAt).toBe(1234);
    expect(s.txCountAtLastBackup).toBe(3);
  });

  it('CSV file', async () => {
    const file = await createCsvFile({ kind: 'range', from: '2026-11-20', to: '2026-11-30', label: '2026-11' });
    expect(file.name).toBe('arus-transaksi-2026-11.csv');
    const text = await file.text();
    expect(text.split('\r\n')).toHaveLength(3);
    expect(text).toContain('Transfer,-100000,,Rekening Bank,Tunai,');
  });
});
