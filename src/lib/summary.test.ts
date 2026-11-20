import { describe, expect, it } from 'vitest';
import { makeTx } from '../test/fixtures';
import { periodByKey } from './period';
import { categoryBreakdown, deltaRatio, donutSegments, groupByDay, periodTotals, periodTrend } from './summary';

const NOV = periodByKey('2026-11', 1);

describe('ringkasan', () => {
  const txs = [
    makeTx({ type: 'expense', amount: 100_000, accountId: 'a', categoryId: 'makan' }),
    makeTx({ type: 'expense', amount: 50_000, accountId: 'a', categoryId: 'transport' }),
    makeTx({ type: 'income', amount: 1_000_000, accountId: 'a', categoryId: 'gaji' }),
    makeTx({ type: 'transfer', amount: 200_000, accountId: 'a', toAccountId: 'b' }),
    makeTx({ type: 'adjustment', amount: -5_000, accountId: 'a' }),
    makeTx({ type: 'expense', amount: 999, accountId: 'a', categoryId: 'makan', date: '2026-10-31' }),
  ];

  it('AC-SM-01 transfer & adjustment tidak dihitung', () => {
    expect(periodTotals(txs, NOV)).toEqual({ income: 1_000_000, expense: 150_000, net: 850_000 });
  });

  it('AC-SM-02 breakdown urut menurun dengan share', () => {
    const rows = categoryBreakdown(txs, 'expense', NOV);
    expect(rows.map((r) => [r.categoryId, r.amount, r.count])).toEqual([
      ['makan', 100_000, 1],
      ['transport', 50_000, 1],
    ]);
    expect(Math.round(rows[0].share * 100)).toBe(67);
    expect(Math.round(rows[1].share * 100)).toBe(33);
  });

  it('AC-SM-03 >7 kategori → 6 terbesar + Lainnya = sisa', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeTx({ type: 'expense', amount: (i + 1) * 1000, accountId: 'a', categoryId: `c${i}` }),
    );
    const segs = donutSegments(categoryBreakdown(many, 'expense', NOV));
    expect(segs).toHaveLength(7);
    expect(segs[6].categoryId).toBeNull();
    expect(segs[6].amount).toBe(1000 + 2000 + 3000);
    expect(segs.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
    const seven = donutSegments(categoryBreakdown(many.slice(0, 7), 'expense', NOV));
    expect(seven.every((s) => s.categoryId !== null)).toBe(true);
  });

  it('AC-SM-04 delta, null jika sebelumnya 0', () => {
    expect(deltaRatio(112, 100)).toBeCloseTo(0.12);
    expect(deltaRatio(5, 0)).toBeNull();
  });

  it('AC-LS-01/02 grup per hari, net harian tanpa transfer/adjustment', () => {
    const t1 = makeTx({ type: 'expense', amount: 10_000, accountId: 'a', categoryId: 'm', date: '2026-11-19' });
    const t2 = makeTx({ type: 'income', amount: 30_000, accountId: 'a', categoryId: 'g', date: '2026-11-20' });
    const t3 = makeTx({ type: 'transfer', amount: 70_000, accountId: 'a', toAccountId: 'b', date: '2026-11-20' });
    const t4 = makeTx({ type: 'expense', amount: 5_000, accountId: 'a', categoryId: 'm', date: '2026-11-20' });
    const groups = groupByDay([t1, t2, t3, t4]);
    expect(groups.map((g) => g.date)).toEqual(['2026-11-20', '2026-11-19']);
    expect(groups[0].items.map((t) => t.id)).toEqual([t4.id, t3.id, t2.id]);
    expect(groups[0].net).toBe(25_000);
    expect(groups[1].net).toBe(-10_000);
  });

  it('AC-SM-05 tren 6 periode dengan periode custom', () => {
    const trend = periodTrend(
      [
        makeTx({ type: 'expense', amount: 1, accountId: 'a', categoryId: 'm', date: '2026-11-24' }),
        makeTx({ type: 'expense', amount: 2, accountId: 'a', categoryId: 'm', date: '2026-11-25' }),
        makeTx({ type: 'income', amount: 3, accountId: 'a', categoryId: 'g', date: '2026-06-24' }),
      ],
      '2026-12',
      25,
    );
    expect(trend.map((t) => t.key)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(trend[4].expense).toBe(1);
    expect(trend[5].expense).toBe(2);
    expect(trend.reduce((s, t) => s + t.income, 0)).toBe(0);
  });
});
