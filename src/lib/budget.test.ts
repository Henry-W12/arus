import { describe, expect, it } from 'vitest';
import { makeBudget, makeCategory, makeTx } from '../test/fixtures';
import { budgetOverview, budgetStatus, dailyAllowance, effectiveBudget } from './budget';
import { periodByKey } from './period';

const makan = makeCategory({ name: 'Makan', sortOrder: 0 });
const transport = makeCategory({ name: 'Transport', sortOrder: 1 });
const gaji = makeCategory({ name: 'Gaji', kind: 'income' });

describe('anggaran berlaku-mulai-bulan', () => {
  const budgets = [
    makeBudget({ categoryId: makan.id, amount: 1_000_000, startPeriod: '2026-10' }),
    makeBudget({ categoryId: makan.id, amount: 1_500_000, startPeriod: '2026-11' }),
    makeBudget({ categoryId: makan.id, amount: 0, startPeriod: '2027-02' }),
  ];

  it('AC-BG-04 Okt tetap 1jt, Nov & Des 1,5jt', () => {
    expect(effectiveBudget(budgets, makan.id, '2026-09')).toBeNull();
    expect(effectiveBudget(budgets, makan.id, '2026-10')).toBe(1_000_000);
    expect(effectiveBudget(budgets, makan.id, '2026-11')).toBe(1_500_000);
    expect(effectiveBudget(budgets, makan.id, '2026-12')).toBe(1_500_000);
  });

  it('AC-BG-05 amount 0 = dihapus mulai periode itu', () => {
    expect(effectiveBudget(budgets, makan.id, '2027-01')).toBe(1_500_000);
    expect(effectiveBudget(budgets, makan.id, '2027-02')).toBeNull();
    expect(effectiveBudget(budgets, makan.id, '2030-01')).toBeNull();
  });

  it('status ambang 80%/100%', () => {
    expect(budgetStatus(799, 1000)).toBe('normal');
    expect(budgetStatus(800, 1000)).toBe('warning');
    expect(budgetStatus(1000, 1000)).toBe('warning');
    expect(budgetStatus(1001, 1000)).toBe('over');
  });

  it('AC-BG-03 sisa per hari dibulatkan ke bawah ke ribuan', () => {
    expect(dailyAllowance(150_000, '2026-11-20', periodByKey('2026-11', 1))).toBe(13_000);
    expect(dailyAllowance(-5_000, '2026-11-20', periodByKey('2026-11', 1))).toBe(0);
  });
});

describe('budgetOverview', () => {
  const period = periodByKey('2026-11', 1);
  const budgets = [makeBudget({ categoryId: makan.id, amount: 1_000_000, startPeriod: '2026-11' })];

  it('AC-BG-01 85% warning, sisa 150rb, per hari pada periode berjalan', () => {
    const o = budgetOverview({
      budgets,
      categories: [makan, transport, gaji],
      transactions: [makeTx({ type: 'expense', amount: 850_000, accountId: 'a', categoryId: makan.id })],
      period,
      currentKey: '2026-11',
      today: '2026-11-20',
    });
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0]).toMatchObject({ spent: 850_000, remaining: 150_000, status: 'warning' });
    expect(o.lines[0].ratio).toBeCloseTo(0.85);
    expect(o.perDay).toEqual({ amount: 13_000, daysLeft: 11 });
  });

  it('AC-BG-02 lebih 120rb → over; AC-BG-06 tanpa anggaran; AC-BG-07 transfer & income diabaikan', () => {
    const o = budgetOverview({
      budgets,
      categories: [makan, transport, gaji],
      transactions: [
        makeTx({ type: 'expense', amount: 1_120_000, accountId: 'a', categoryId: makan.id }),
        makeTx({ type: 'expense', amount: 40_000, accountId: 'a', categoryId: transport.id }),
        makeTx({ type: 'income', amount: 9_000_000, accountId: 'a', categoryId: gaji.id }),
        makeTx({ type: 'transfer', amount: 500_000, accountId: 'a', toAccountId: 'b' }),
      ],
      period,
      currentKey: '2026-12',
      today: '2026-12-02',
    });
    expect(o.lines[0]).toMatchObject({ remaining: -120_000, status: 'over' });
    expect(o.unbudgeted).toEqual([{ categoryId: transport.id, spent: 40_000 }]);
    expect(o.total).toMatchObject({ budget: 1_000_000, spent: 1_120_000 });
    expect(o.perDay).toBeNull();
  });

  it('kategori diarsipkan tampil di periode lampau, hilang di periode berjalan tanpa pengeluaran', () => {
    const archived = { ...makan, archived: 1 as const };
    const base = { budgets, categories: [archived, transport], transactions: [], today: '2026-12-02' };
    expect(budgetOverview({ ...base, period, currentKey: '2026-12' }).lines).toHaveLength(1);
    expect(budgetOverview({ ...base, period: periodByKey('2026-12', 1), currentKey: '2026-12' }).lines).toHaveLength(0);
  });

  it('kunci anggaran ditafsirkan dengan S baru (S=25)', () => {
    const o = budgetOverview({
      budgets,
      categories: [makan],
      transactions: [
        makeTx({ type: 'expense', amount: 100_000, accountId: 'a', categoryId: makan.id, date: '2026-10-25' }),
        makeTx({ type: 'expense', amount: 1, accountId: 'a', categoryId: makan.id, date: '2026-11-25' }),
      ],
      period: periodByKey('2026-11', 25),
      currentKey: '2026-11',
      today: '2026-11-20',
    });
    expect(o.lines[0].spent).toBe(100_000);
    expect(o.perDay?.daysLeft).toBe(5);
  });
});
