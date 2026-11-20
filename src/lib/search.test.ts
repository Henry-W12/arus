import { describe, expect, it } from 'vitest';
import { makeTx } from '../test/fixtures';
import { amountQuery, datePresetRange, normalizeText, recentNotes, searchTransactions, type SearchLookup } from './search';

const lookup: SearchLookup = {
  categories: new Map([
    ['makan', { name: 'Makan & Minum' }],
    ['transport', { name: 'Transportasi' }],
    ['gaji', { name: 'Gaji' }],
  ]),
  accounts: new Map([
    ['tunai', { name: 'Tunai' }],
    ['bca', { name: 'BCA' }],
  ]),
};

const txs = [
  makeTx({ type: 'expense', amount: 25_000, accountId: 'tunai', categoryId: 'makan', note: 'Kopi Kenangan', date: '2026-11-18' }),
  makeTx({ type: 'expense', amount: 30_000, accountId: 'tunai', categoryId: 'makan', note: 'KOPI', date: '2026-10-05' }),
  makeTx({ type: 'expense', amount: 45_000, accountId: 'bca', categoryId: 'makan', note: 'Café Tujuh', date: '2026-10-10' }),
  makeTx({ type: 'expense', amount: 250_000, accountId: 'bca', categoryId: 'transport', date: '2026-10-20' }),
  makeTx({ type: 'income', amount: 1_200_000, accountId: 'bca', categoryId: 'gaji', date: '2026-10-25' }),
  makeTx({ type: 'transfer', amount: 100_000, accountId: 'tunai', toAccountId: 'bca', date: '2026-11-01' }),
  makeTx({ type: 'transfer', amount: 500_000, accountId: 'bca', toAccountId: 'tunai', date: '2026-11-02', recurringId: 'r1' }),
  makeTx({ type: 'adjustment', amount: -25_000, accountId: 'tunai', date: '2026-11-03' }),
];

const ids = (filter: Parameters<typeof searchTransactions>[1]) =>
  searchTransactions(txs, filter, lookup).items.map((t) => txs.indexOf(t));

describe('pencarian', () => {
  it('AC-SR-01 case & diakritik insensitive', () => {
    expect(normalizeText('Café')).toBe('cafe');
    expect(ids({ query: 'kopi' }).sort()).toEqual([0, 1]);
    expect(ids({ query: 'cafe' })).toEqual([2]);
  });

  it('cocok nama kategori & akun', () => {
    expect(ids({ query: 'transpor' })).toEqual([3]);
    expect(ids({ query: 'bca', types: ['transfer'] }).sort()).toEqual([5, 6]);
  });

  it('AC-SR-02 query nominal mencocokkan amount persis', () => {
    expect(amountQuery('25rb')).toBe(25_000);
    expect(amountQuery('kopi 25')).toBeNull();
    expect(ids({ query: '25rb' }).sort()).toEqual([0, 7]);
    expect(ids({ query: '1,2jt' })).toEqual([4]);
  });

  it('AC-SR-03 filter kategori + bulan lalu, ringkasan hasil', () => {
    const range = datePresetRange('lastPeriod', '2026-11-20', 1);
    const res = searchTransactions(txs, { categoryIds: ['makan', 'transport'], dateFrom: range.from, dateTo: range.to }, lookup);
    expect(res.items.map((t) => txs.indexOf(t))).toEqual([3, 2, 1]);
    expect(res.count).toBe(3);
    expect(res.totals.expense).toBe(325_000);
  });

  it('AC-SR-04 filter akun mencakup transfer dari/ke', () => {
    expect(ids({ accountIds: ['tunai'] }).sort()).toEqual([0, 1, 5, 6, 7]);
  });

  it('AC-SR-05 nominal min–maks inklusif', () => {
    expect(ids({ minAmount: 100_000, maxAmount: 500_000 }).sort()).toEqual([3, 5, 6]);
  });

  it('AC-SR-06 tanpa hasil & filter berulang', () => {
    expect(ids({ query: 'tidak-ada' })).toEqual([]);
    expect(ids({ recurringOnly: true })).toEqual([6]);
  });

  it('preset tanggal periode custom', () => {
    expect(datePresetRange('thisPeriod', '2026-11-20', 25)).toEqual({ from: '2026-10-25', to: '2026-11-24' });
    expect(datePresetRange('last3Periods', '2026-11-20', 1)).toEqual({ from: '2026-09-01', to: '2026-11-30' });
    expect(datePresetRange('thisYear', '2026-11-20', 25)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('recentNotes unik terbaru dulu', () => {
    expect(recentNotes(txs, 'makan')).toEqual(['Kopi Kenangan', 'Café Tujuh', 'KOPI']);
  });
});
