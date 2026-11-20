import type { Account, Category, ID, LocalDate, Transaction, TransactionType } from '../db/schema';
import { compareNewestFirst } from './balances';
import { parseLocalDate } from './dates';
import { parseAmountText } from './money';
import { periodOf, shiftPeriod, periodByKey } from './period';
import { isScheduled } from './effective';
import { totalsOf, type Totals } from './summary';

export interface SearchFilter {
  query?: string;
  types?: readonly TransactionType[];
  categoryIds?: readonly ID[];
  /** Cocok dengan `accountId` ATAU `toAccountId` (transfer). */
  accountIds?: readonly ID[];
  /** Inklusif. */
  dateFrom?: LocalDate;
  /** Inklusif. */
  dateTo?: LocalDate;
  /** Inklusif, atas |amount|. */
  minAmount?: number;
  maxAmount?: number;
  /** Hanya transaksi hasil aturan berulang. */
  recurringOnly?: boolean;
  /** Hanya transaksi dengan `createdAt ≥ since` (banner "N transaksi berulang dicatat"). */
  createdSince?: number;
}

export interface SearchLookup {
  categories: ReadonlyMap<ID, Pick<Category, 'name'>>;
  accounts: ReadonlyMap<ID, Pick<Account, 'name'>>;
}

/** Lowercase + hapus diakritik ("Café" → "cafe"). */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const AMOUNT_QUERY_RE = /^(rp)?\s*\d[\d.,]*\s*(rb|k|jt|m)?$/i;

/** Jika query berupa nominal ("25rb", "1,2jt", "25.000") → integer, selain itu null. */
export function amountQuery(query: string): number | null {
  const q = query.trim();
  if (!AMOUNT_QUERY_RE.test(q)) return null;
  return parseAmountText(q);
}

export function isFilterEmpty(filter: SearchFilter): boolean {
  return (
    !filter.query?.trim() &&
    !filter.types?.length &&
    !filter.categoryIds?.length &&
    !filter.accountIds?.length &&
    !filter.dateFrom &&
    !filter.dateTo &&
    filter.minAmount === undefined &&
    filter.maxAmount === undefined &&
    !filter.recurringOnly &&
    filter.createdSince === undefined
  );
}

/** Buat predikat dari filter (semua kriteria harus terpenuhi). */
export function makeMatcher(filter: SearchFilter, lookup: SearchLookup): (tx: Transaction) => boolean {
  const raw = filter.query?.trim() ?? '';
  const amountQ = raw ? amountQuery(raw) : null;
  const textQ = raw && amountQ === null ? normalizeText(raw) : '';
  const types = filter.types?.length ? new Set(filter.types) : null;
  const cats = filter.categoryIds?.length ? new Set(filter.categoryIds) : null;
  const accs = filter.accountIds?.length ? new Set(filter.accountIds) : null;
  const normCache = new Map<string, string>();
  const norm = (s: string) => {
    let v = normCache.get(s);
    if (v === undefined) {
      v = normalizeText(s);
      normCache.set(s, v);
    }
    return v;
  };

  return (tx) => {
    if (types && !types.has(tx.type)) return false;
    if (cats && !(tx.categoryId && cats.has(tx.categoryId))) return false;
    if (accs && !accs.has(tx.accountId) && !(tx.toAccountId && accs.has(tx.toAccountId))) return false;
    if (filter.dateFrom && tx.date < filter.dateFrom) return false;
    if (filter.dateTo && tx.date > filter.dateTo) return false;
    const abs = Math.abs(tx.amount);
    if (filter.minAmount !== undefined && abs < filter.minAmount) return false;
    if (filter.maxAmount !== undefined && abs > filter.maxAmount) return false;
    if (filter.recurringOnly && !tx.recurringId) return false;
    if (filter.createdSince !== undefined && tx.createdAt < filter.createdSince) return false;
    if (amountQ !== null) return abs === amountQ;
    if (textQ) {
      const haystack = [
        tx.note,
        tx.categoryId ? lookup.categories.get(tx.categoryId)?.name : undefined,
        lookup.accounts.get(tx.accountId)?.name,
        tx.toAccountId ? lookup.accounts.get(tx.toAccountId)?.name : undefined,
      ];
      return haystack.some((h) => h !== undefined && norm(h).includes(textQ));
    }
    return true;
  };
}

export interface SearchResult {
  items: Transaction[];
  count: number;
  /** Hanya transaksi yang sudah berlaku (terjadwal tidak dihitung, PRD §5.1). */
  totals: Totals;
  /** Jumlah hasil yang masih terjadwal (tampil, tetapi tidak masuk `totals`). */
  scheduledCount: number;
}

/** Filter in-memory, hasil urut terbaru dulu. */
export function searchTransactions(
  txs: readonly Transaction[],
  filter: SearchFilter,
  lookup: SearchLookup,
  today?: LocalDate,
): SearchResult {
  const match = makeMatcher(filter, lookup);
  const items = txs.filter(match).sort(compareNewestFirst);
  const scheduled = today ? items.filter((t) => isScheduled(t, today)) : [];
  const effective = scheduled.length ? items.filter((t) => !isScheduled(t, today!)) : items;
  return { items, count: items.length, totals: totalsOf(effective), scheduledCount: scheduled.length };
}

export type DatePreset = 'thisPeriod' | 'lastPeriod' | 'last3Periods' | 'thisYear';

/** Rentang preset filter tanggal ("Bulan ini" dst., memakai periode custom). */
export function datePresetRange(preset: DatePreset, today: LocalDate, startDay: number): { from: LocalDate; to: LocalDate } {
  const current = periodOf(today, startDay);
  switch (preset) {
    case 'thisPeriod':
      return { from: current.start, to: current.end };
    case 'lastPeriod': {
      const p = periodByKey(shiftPeriod(current.key, -1), startDay);
      return { from: p.start, to: p.end };
    }
    case 'last3Periods':
      return { from: periodByKey(shiftPeriod(current.key, -2), startDay).start, to: current.end };
    case 'thisYear': {
      const { y } = parseLocalDate(today);
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
  }
}

/** Kategori & catatan yang paling sering dipakai (saran sebelum mengetik). */
export function searchSuggestions(txs: readonly Transaction[], limit = 5): { categoryIds: ID[]; notes: string[] } {
  const catCount = new Map<ID, number>();
  const noteCount = new Map<string, { note: string; count: number }>();
  for (const tx of txs) {
    if (tx.categoryId) catCount.set(tx.categoryId, (catCount.get(tx.categoryId) ?? 0) + 1);
    if (tx.note) {
      const key = normalizeText(tx.note);
      const entry = noteCount.get(key) ?? { note: tx.note, count: 0 };
      entry.count += 1;
      noteCount.set(key, entry);
    }
  }
  return {
    categoryIds: [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id),
    notes: [...noteCount.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((e) => e.note),
  };
}

/** 5 catatan unik terakhir untuk kategori (saran di sheet input). */
export function recentNotes(txs: readonly Transaction[], categoryId: ID, limit = 5): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const tx of [...txs].sort(compareNewestFirst)) {
    if (tx.categoryId !== categoryId || !tx.note) continue;
    const key = normalizeText(tx.note);
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(tx.note);
    if (notes.length >= limit) break;
  }
  return notes;
}
