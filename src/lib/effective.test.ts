import { describe, expect, it } from 'vitest';
import { makeAccount, makeBudget, makeCategory, makeTx } from '../test/fixtures';
import { computeBalances } from './balances';
import { budgetOverview } from './budget';
import { effectiveOnly, isEffective, isScheduled } from './effective';
import { periodByKey } from './period';
import { searchTransactions } from './search';
import { periodTotals } from './summary';

/** BUG-01: satu aturan transaksi Terjadwal untuk semua agregasi (PRD §5.1). */
const TODAY = '2026-11-20';
const NOV = periodByKey('2026-11', 1);

describe('aturan transaksi terjadwal', () => {
  const makan = makeCategory({ name: 'Makan', sortOrder: 0 });
  const acc = makeAccount({ name: 'Tunai', openingBalance: 1_000_000 });
  const past = makeTx({ type: 'expense', amount: 100_000, accountId: acc.id, categoryId: makan.id, date: '2026-11-10' });
  const todayTx = makeTx({ type: 'expense', amount: 50_000, accountId: acc.id, categoryId: makan.id, date: TODAY });
  const future = makeTx({ type: 'expense', amount: 400_000, accountId: acc.id, categoryId: makan.id, date: '2026-11-28' });
  const txs = [past, todayTx, future];

  it('hari ini berlaku, besok terjadwal', () => {
    expect(isEffective(todayTx, TODAY)).toBe(true);
    expect(isScheduled(future, TODAY)).toBe(true);
    expect(effectiveOnly(txs, TODAY)).toEqual([past, todayTx]);
  });

  it('ringkasan periode tidak menghitung terjadwal', () => {
    expect(periodTotals(effectiveOnly(txs, TODAY), NOV).expense).toBe(150_000);
    // Setelah tanggalnya tiba, ikut dihitung.
    expect(periodTotals(effectiveOnly(txs, '2026-11-28'), NOV).expense).toBe(550_000);
  });

  it('anggaran tidak memakai terjadwal sebagai terpakai', () => {
    const o = budgetOverview({
      budgets: [makeBudget({ categoryId: makan.id, amount: 1_000_000, startPeriod: '2026-11' })],
      categories: [makan],
      transactions: txs,
      period: NOV,
      currentKey: '2026-11',
      today: TODAY,
    });
    expect(o.lines[0]).toMatchObject({ spent: 150_000, remaining: 850_000, status: 'normal' });
    expect(o.perDay?.amount).toBe(77_000);
  });

  it('saldo hari ini mengabaikan terjadwal, saldo setelah terjadwal menghitungnya', () => {
    expect(computeBalances([acc], txs, TODAY).get(acc.id)).toBe(850_000);
    expect(computeBalances([acc], txs).get(acc.id)).toBe(450_000);
  });

  it('pencarian menampilkan terjadwal tetapi tidak menjumlahkannya', () => {
    const lookup = { categories: new Map([[makan.id, { name: 'Makan' }]]), accounts: new Map([[acc.id, { name: 'Tunai' }]]) };
    const r = searchTransactions(txs, { categoryIds: [makan.id] }, lookup, TODAY);
    expect(r.count).toBe(3);
    expect(r.scheduledCount).toBe(1);
    expect(r.totals.expense).toBe(150_000);
  });
});
