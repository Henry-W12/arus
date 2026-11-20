import type { CategoryKind, ID, LocalDate, PeriodKey, Transaction } from '../db/schema';
import { compareNewestFirst } from './balances';
import { isDateInPeriod, lastPeriods, periodByKey, type Period } from './period';

export interface Totals {
  income: number;
  expense: number;
  /** income − expense. */
  net: number;
}

/** Pemasukan/pengeluaran (transfer & adjustment diabaikan). */
export function totalsOf(txs: Iterable<Transaction>): Totals {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export function transactionsInPeriod(txs: readonly Transaction[], period: Period): Transaction[] {
  return txs.filter((t) => isDateInPeriod(t.date, period));
}

export function periodTotals(txs: readonly Transaction[], period: Period): Totals {
  return totalsOf(transactionsInPeriod(txs, period));
}

export interface CategoryRow {
  categoryId: ID;
  amount: number;
  count: number;
  /** 0..1 terhadap total kind tersebut. */
  share: number;
}

/** Ringkasan per kategori untuk satu kind, urut nominal menurun. */
export function categoryBreakdown(txs: readonly Transaction[], kind: CategoryKind, period?: Period): CategoryRow[] {
  const map = new Map<ID, { amount: number; count: number }>();
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== kind || !tx.categoryId) continue;
    if (period && !isDateInPeriod(tx.date, period)) continue;
    const row = map.get(tx.categoryId) ?? { amount: 0, count: 0 };
    row.amount += tx.amount;
    row.count += 1;
    map.set(tx.categoryId, row);
    total += tx.amount;
  }
  return [...map.entries()]
    .map(([categoryId, r]) => ({ categoryId, amount: r.amount, count: r.count, share: total ? r.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || (a.categoryId < b.categoryId ? -1 : 1));
}

export interface DonutSegment {
  /** `null` = gabungan "Lainnya". */
  categoryId: ID | null;
  amount: number;
  share: number;
}

/** Maks. `maxSegments` segmen terbesar + "Lainnya"; jika total kategori ≤ maxSegments+1, semua ditampilkan. */
export function donutSegments(rows: readonly CategoryRow[], maxSegments = 6): DonutSegment[] {
  const segs = rows.map((r) => ({ categoryId: r.categoryId as ID | null, amount: r.amount, share: r.share }));
  if (segs.length <= maxSegments + 1) return segs;
  const head = segs.slice(0, maxSegments);
  const rest = segs.slice(maxSegments);
  return [
    ...head,
    {
      categoryId: null,
      amount: rest.reduce((s, r) => s + r.amount, 0),
      share: rest.reduce((s, r) => s + r.share, 0),
    },
  ];
}

/**
 * Perubahan relatif terhadap periode sebelumnya. `null` jika sebelumnya 0 (tampilkan "—").
 * Dibagi |previous| agar tanda selalu = arah perubahan (−200rb → −100rb = +50%, membaik).
 */
export function deltaRatio(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export interface DayGroup {
  date: LocalDate;
  /** Urut `createdAt` menurun. */
  items: Transaction[];
  /** income − expense hari itu. */
  net: number;
}

/** Kelompokkan per hari, tanggal terbaru di atas. */
export function groupByDay(txs: readonly Transaction[]): DayGroup[] {
  const sorted = [...txs].sort(compareNewestFirst);
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, items: [], net: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    if (tx.type === 'income') group.net += tx.amount;
    else if (tx.type === 'expense') group.net -= tx.amount;
  }
  return groups;
}

export interface TrendPoint extends Totals {
  key: PeriodKey;
}

/** Tren `n` periode berakhir di `key` (paling lama dulu). */
export function periodTrend(txs: readonly Transaction[], key: PeriodKey, startDay: number, n = 6): TrendPoint[] {
  const periods = lastPeriods(key, n).map((k) => periodByKey(k, startDay));
  const buckets = periods.map(() => ({ income: 0, expense: 0 }));
  for (const tx of txs) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    const idx = periods.findIndex((p) => isDateInPeriod(tx.date, p));
    if (idx < 0) continue;
    buckets[idx][tx.type] += tx.amount;
  }
  return periods.map((p, i) => ({ key: p.key, ...buckets[i], net: buckets[i].income - buckets[i].expense }));
}

/** Tanggal transaksi paling awal (untuk membatasi navigasi periode). */
export function earliestDate(txs: readonly Transaction[]): LocalDate | null {
  let min: LocalDate | null = null;
  for (const tx of txs) if (min === null || tx.date < min) min = tx.date;
  return min;
}
