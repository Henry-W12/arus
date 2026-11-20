import { describe, expect, it } from 'vitest';
import { makeAccount, makeTx } from '../test/fixtures';
import { adjustmentDelta, computeBalances, runningBalances, totalBalance, transactionEffect } from './balances';
import { periodTotals } from './summary';
import { periodByKey } from './period';

const TODAY = '2026-11-20';

describe('computeBalances (AC-AC-01)', () => {
  const tunai = makeAccount({ name: 'Tunai', openingBalance: 500_000 });
  const bca = makeAccount({ name: 'BCA' });
  const kartu = makeAccount({ name: 'Kartu', openingBalance: -200_000, includeInTotal: 0 });
  const accounts = [tunai, bca, kartu];

  it('1. tanpa transaksi = saldo awal (boleh negatif)', () => {
    const b = computeBalances(accounts, [], TODAY);
    expect([b.get(tunai.id), b.get(bca.id), b.get(kartu.id)]).toEqual([500_000, 0, -200_000]);
  });

  it('2. income menambah, 3. expense mengurangi', () => {
    const txs = [
      makeTx({ type: 'income', amount: 1_000_000, accountId: bca.id, categoryId: 'g' }),
      makeTx({ type: 'expense', amount: 25_000, accountId: tunai.id, categoryId: 'm' }),
    ];
    const b = computeBalances(accounts, txs, TODAY);
    expect(b.get(bca.id)).toBe(1_000_000);
    expect(b.get(tunai.id)).toBe(475_000);
  });

  it('4. AC-AC-02 transfer memindahkan saldo, total tetap, ringkasan tidak berubah', () => {
    const txs = [makeTx({ type: 'transfer', amount: 200_000, accountId: tunai.id, toAccountId: bca.id })];
    const before = computeBalances(accounts, [], TODAY);
    const after = computeBalances(accounts, txs, TODAY);
    expect(after.get(tunai.id)).toBe(300_000);
    expect(after.get(bca.id)).toBe(200_000);
    expect(totalBalance(accounts, after)).toBe(totalBalance(accounts, before));
    expect(periodTotals(txs, periodByKey('2026-11', 1))).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('5. adjustment positif & negatif (AC-AC-04)', () => {
    const txs = [
      makeTx({ type: 'transfer', amount: 200_000, accountId: tunai.id, toAccountId: bca.id }),
      makeTx({ type: 'adjustment', amount: adjustmentDelta(300_000, 287_500), accountId: tunai.id }),
      makeTx({ type: 'adjustment', amount: 10_000, accountId: bca.id }),
    ];
    const b = computeBalances(accounts, txs, TODAY);
    expect(b.get(tunai.id)).toBe(287_500);
    expect(b.get(bca.id)).toBe(210_000);
    expect(periodTotals(txs, periodByKey('2026-11', 1)).expense).toBe(0);
  });

  it('6. transaksi masa depan tidak dihitung per hari ini, dihitung di saldo terjadwal (AC-LS-06)', () => {
    const txs = [makeTx({ type: 'expense', amount: 50_000, accountId: tunai.id, categoryId: 'm', date: '2026-11-21' })];
    expect(computeBalances(accounts, txs, TODAY).get(tunai.id)).toBe(500_000);
    expect(computeBalances(accounts, txs).get(tunai.id)).toBe(450_000);
    expect(computeBalances(accounts, txs, '2026-11-21').get(tunai.id)).toBe(450_000);
  });

  it('7. edit transaksi lama otomatis benar (dihitung ulang)', () => {
    const old = makeTx({ type: 'expense', amount: 100_000, accountId: tunai.id, categoryId: 'm', date: '2025-01-01' });
    const edited = { ...old, amount: 40_000 };
    expect(computeBalances(accounts, [old], TODAY).get(tunai.id)).toBe(400_000);
    expect(computeBalances(accounts, [edited], TODAY).get(tunai.id)).toBe(460_000);
  });

  it('8. hapus transaksi lama mengembalikan saldo', () => {
    const t1 = makeTx({ type: 'expense', amount: 100_000, accountId: tunai.id, categoryId: 'm', date: '2025-01-01' });
    const t2 = makeTx({ type: 'income', amount: 30_000, accountId: tunai.id, categoryId: 'g' });
    expect(computeBalances(accounts, [t1, t2], TODAY).get(tunai.id)).toBe(430_000);
    expect(computeBalances(accounts, [t2], TODAY).get(tunai.id)).toBe(530_000);
  });

  it('9. includeInTotal=0 dan akun arsip tidak masuk total (AC-AC-08)', () => {
    const arsip = makeAccount({ openingBalance: 1_000, archived: 1 });
    const all = [...accounts, arsip];
    const b = computeBalances(all, [], TODAY);
    expect(b.get(kartu.id)).toBe(-200_000);
    expect(totalBalance(all, b)).toBe(500_000);
  });

  it('10. transfer ke akun yang tidak dikenal hanya memengaruhi akun asal', () => {
    const txs = [makeTx({ type: 'transfer', amount: 1_000, accountId: tunai.id, toAccountId: 'ghost' })];
    const b = computeBalances(accounts, txs, TODAY);
    expect(b.get(tunai.id)).toBe(499_000);
    expect(b.has('ghost')).toBe(false);
  });

  it('11. saldo negatif boleh', () => {
    const txs = [makeTx({ type: 'expense', amount: 600_000, accountId: tunai.id, categoryId: 'm' })];
    expect(computeBalances(accounts, txs, TODAY).get(tunai.id)).toBe(-100_000);
  });

  it('12. efek transaksi per akun', () => {
    const tf = makeTx({ type: 'transfer', amount: 5, accountId: tunai.id, toAccountId: bca.id });
    expect(transactionEffect(tf, tunai.id)).toBe(-5);
    expect(transactionEffect(tf, bca.id)).toBe(5);
    expect(transactionEffect(tf, kartu.id)).toBe(0);
  });
});

describe('runningBalances (AC-AC-07)', () => {
  it('saldo berjalan konsisten dengan saldo akhir, urut tanggal lalu createdAt', () => {
    const acc = makeAccount({ openingBalance: 100_000 });
    const other = makeAccount();
    const txs = [
      makeTx({ type: 'expense', amount: 10_000, accountId: acc.id, categoryId: 'm', date: '2026-11-02' }),
      makeTx({ type: 'income', amount: 50_000, accountId: acc.id, categoryId: 'g', date: '2026-11-01' }),
      makeTx({ type: 'transfer', amount: 20_000, accountId: other.id, toAccountId: acc.id, date: '2026-11-02' }),
      makeTx({ type: 'expense', amount: 99, accountId: other.id, categoryId: 'm' }),
    ];
    const running = runningBalances(acc, txs);
    expect(running.get(txs[1].id)).toBe(150_000);
    expect(running.get(txs[0].id)).toBe(140_000);
    expect(running.get(txs[2].id)).toBe(160_000);
    expect(running.has(txs[3].id)).toBe(false);
    expect(computeBalances([acc], txs).get(acc.id)).toBe(160_000);
  });
});
