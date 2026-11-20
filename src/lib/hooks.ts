import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/db';
import { mergeSettings } from '../db/repo';
import type {
  Account,
  Category,
  CategoryKind,
  ID,
  LocalDate,
  PeriodKey,
  RecurringRule,
  Settings,
  Template,
  Transaction,
} from '../db/schema';
import { computeBalances, runningBalances, totalBalance, type BalanceMap } from './balances';
import { budgetOverview, type BudgetOverview } from './budget';
import { todayLocal } from './dates';
import { periodByKey, periodOf, shiftPeriod, type Period } from './period';
import { recentNotes, searchTransactions, type SearchFilter, type SearchResult } from './search';
import { shouldShowBackupReminder, isStandalone } from './storage';
import {
  categoryBreakdown,
  deltaRatio,
  donutSegments,
  earliestDate,
  groupByDay,
  periodTrend,
  totalsOf,
  type CategoryRow,
  type DayGroup,
  type DonutSegment,
  type Totals,
  type TrendPoint,
} from './summary';

/*
 * Semua hook berbasis useLiveQuery mengembalikan `undefined` selama data pertama dimuat,
 * lalu otomatis memperbarui saat DB berubah.
 */

const bySortOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

/** Tanggal lokal hari ini; diperbarui saat app kembali terlihat dan tiap 60 detik (lewat tengah malam). */
export function useToday(): LocalDate {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    const refresh = () => setToday((prev) => {
      const now = todayLocal();
      return now === prev ? prev : now;
    });
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}

/** Semua pengaturan (digabung dengan default). */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => mergeSettings(await db.settings.toArray()), []);
}

/** Akun urut `sortOrder`. Default hanya yang aktif. */
export function useAccounts(options: { includeArchived?: boolean } = {}): Account[] | undefined {
  const includeArchived = options.includeArchived ?? false;
  return useLiveQuery(async () => {
    const all = await db.accounts.orderBy('sortOrder').toArray();
    return includeArchived ? all : all.filter((a) => a.archived === 0);
  }, [includeArchived]);
}

/** Kategori urut `sortOrder` (urutan grid input). `kind` opsional. Default hanya yang aktif. */
export function useCategories(kind?: CategoryKind, options: { includeArchived?: boolean } = {}): Category[] | undefined {
  const includeArchived = options.includeArchived ?? false;
  return useLiveQuery(async () => {
    const rows = kind ? await db.categories.where('kind').equals(kind).toArray() : await db.categories.toArray();
    return rows.filter((c) => includeArchived || c.archived === 0).sort(bySortOrder);
  }, [kind, includeArchived]);
}

export interface Lookup {
  accounts: Map<ID, Account>;
  categories: Map<ID, Category>;
}

/** Peta id → akun/kategori (termasuk yang diarsipkan) untuk menampilkan nama di riwayat. */
export function useLookup(): Lookup | undefined {
  return useLiveQuery(async () => {
    const [accounts, categories] = await Promise.all([db.accounts.toArray(), db.categories.toArray()]);
    return {
      accounts: new Map(accounts.map((a) => [a.id, a])),
      categories: new Map(categories.map((c) => [c.id, c])),
    };
  }, []);
}

/** Semua transaksi (tidak berurutan). */
export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.toArray(), []);
}

/** Periode berjalan sesuai `periodStartDay`. */
export function useCurrentPeriod(): Period | undefined {
  const today = useToday();
  const settings = useSettings();
  return useMemo(() => (settings ? periodOf(today, settings.periodStartDay) : undefined), [settings, today]);
}

/** Periode untuk `key`; tanpa `key` = periode berjalan. */
export function usePeriod(key?: PeriodKey): Period | undefined {
  const current = useCurrentPeriod();
  const settings = useSettings();
  return useMemo(() => {
    if (!settings || !current) return undefined;
    return key ? periodByKey(key, settings.periodStartDay) : current;
  }, [current, key, settings]);
}

/** Transaksi dengan tanggal dalam rentang inklusif. */
export function useTransactionsInRange(from: LocalDate | undefined, to: LocalDate | undefined): Transaction[] | undefined {
  return useLiveQuery(
    async () => (from && to ? db.transactions.where('date').between(from, to, true, true).toArray() : undefined),
    [from, to],
  );
}

export interface PeriodTransactions {
  period: Period;
  /** Per hari, terbaru di atas; item urut `createdAt` menurun. */
  groups: DayGroup[];
  totals: Totals;
  count: number;
}

/** Daftar transaksi satu periode (tab Transaksi; muat periode sebelumnya dengan `shiftPeriod`). */
export function usePeriodTransactions(key?: PeriodKey): PeriodTransactions | undefined {
  const period = usePeriod(key);
  const txs = useTransactionsInRange(period?.start, period?.end);
  return useMemo(() => {
    if (!period || !txs) return undefined;
    return { period, groups: groupByDay(txs), totals: totalsOf(txs), count: txs.length };
  }, [period, txs]);
}

/** Transaksi bertanggal setelah `date` (mis. terjadwal di luar periode berjalan). */
export function useTransactionsAfter(date: LocalDate): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.where('date').above(date).toArray(), [date]);
}

export interface BalancesData {
  /** Saldo per akun per hari ini (transaksi terjadwal belum dihitung). */
  balances: BalanceMap;
  /** Saldo termasuk transaksi terjadwal ("Saldo setelah terjadwal"). */
  scheduled: BalanceMap;
  /** Σ akun aktif dengan includeInTotal=1. */
  total: number;
  accounts: Account[];
}

/** Saldo semua akun + total saldo. */
export function useBalances(): BalancesData | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const [accounts, txs] = await Promise.all([db.accounts.orderBy('sortOrder').toArray(), db.transactions.toArray()]);
    const balances = computeBalances(accounts, txs, today);
    return { balances, scheduled: computeBalances(accounts, txs), total: totalBalance(accounts, balances), accounts };
  }, [today]);
}

export interface AccountDetail {
  account: Account;
  balance: number;
  /** Berbeda dari `balance` jika ada transaksi terjadwal. */
  scheduledBalance: number;
  groups: DayGroup[];
  /** Saldo berjalan setelah tiap transaksi (key = id transaksi). */
  running: Map<ID, number>;
}

/** Detail akun: saldo, riwayat per hari (termasuk transfer masuk/keluar), saldo berjalan. `null` jika tidak ada. */
export function useAccountDetail(accountId: ID): AccountDetail | null | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const account = await db.accounts.get(accountId);
    if (!account) return null;
    const [from, to] = await Promise.all([
      db.transactions.where('accountId').equals(accountId).toArray(),
      db.transactions.where('toAccountId').equals(accountId).toArray(),
    ]);
    const txs = [...new Map([...from, ...to].map((t) => [t.id, t])).values()];
    return {
      account,
      balance: computeBalances([account], txs, today).get(accountId) ?? 0,
      scheduledBalance: computeBalances([account], txs).get(accountId) ?? 0,
      groups: groupByDay(txs),
      running: runningBalances(account, txs),
    };
  }, [accountId, today]);
}

export interface PeriodSummary {
  period: Period;
  totals: Totals;
  previousTotals: Totals;
  /** Rasio perubahan vs periode sebelumnya; `null` = sebelumnya 0 ("—"). */
  delta: { income: number | null; expense: number | null; net: number | null };
  breakdown: CategoryRow[];
  segments: DonutSegment[];
  trend: TrendPoint[];
  /** Periode paling awal yang punya transaksi (batas navigasi ‹). */
  firstKey: PeriodKey | null;
}

/** Data layar Ringkasan untuk periode `key` dan jenis donat `kind`. */
export function usePeriodSummary(key: PeriodKey | undefined, kind: CategoryKind = 'expense'): PeriodSummary | undefined {
  const settings = useSettings();
  const txs = useAllTransactions();
  return useMemo(() => {
    if (!settings || !txs || !key) return undefined;
    const s = settings.periodStartDay;
    const period = periodByKey(key, s);
    const prev = periodByKey(shiftPeriod(key, -1), s);
    const inPeriod = txs.filter((t) => t.date >= period.start && t.date <= period.end);
    const totals = totalsOf(inPeriod);
    const previousTotals = totalsOf(txs.filter((t) => t.date >= prev.start && t.date <= prev.end));
    const breakdown = categoryBreakdown(inPeriod, kind);
    const first = earliestDate(txs);
    return {
      period,
      totals,
      previousTotals,
      delta: {
        income: deltaRatio(totals.income, previousTotals.income),
        expense: deltaRatio(totals.expense, previousTotals.expense),
        net: deltaRatio(totals.net, previousTotals.net),
      },
      breakdown,
      segments: donutSegments(breakdown),
      trend: periodTrend(txs, key, s, 6),
      firstKey: first ? periodOf(first, s).key : null,
    };
  }, [key, kind, settings, txs]);
}

/** Data layar Anggaran untuk periode `key` (default periode berjalan). */
export function useBudgetOverview(key?: PeriodKey): BudgetOverview | undefined {
  const today = useToday();
  const period = usePeriod(key);
  const current = useCurrentPeriod();
  const data = useLiveQuery(async () => {
    if (!period) return undefined;
    const [budgets, categories, transactions] = await Promise.all([
      db.budgets.toArray(),
      db.categories.where('kind').equals('expense').toArray(),
      db.transactions.where('date').between(period.start, period.end, true, true).toArray(),
    ]);
    return { budgets, categories, transactions };
  }, [period?.start, period?.end]);
  return useMemo(() => {
    if (!data || !period || !current) return undefined;
    return budgetOverview({ ...data, period, currentKey: current.key, today });
  }, [current, data, period, today]);
}

/** Hasil pencarian/filter in-memory. Debounce query di UI (150 ms). */
export function useSearch(filter: SearchFilter): SearchResult | undefined {
  const txs = useAllTransactions();
  const lookup = useLookup();
  return useMemo(() => (txs && lookup ? searchTransactions(txs, filter, lookup) : undefined), [filter, lookup, txs]);
}

/** 5 catatan terakhir untuk kategori (saran input catatan). */
export function useRecentNotes(categoryId: ID | undefined, limit = 5): string[] | undefined {
  return useLiveQuery(async () => {
    if (!categoryId) return [];
    return recentNotes(await db.transactions.where('categoryId').equals(categoryId).toArray(), categoryId, limit);
  }, [categoryId, limit]);
}

/** Favorit urut `sortOrder`. */
export function useTemplates(): Template[] | undefined {
  return useLiveQuery(() => db.templates.orderBy('sortOrder').toArray(), []);
}

/** Aturan berulang: aktif dulu, lalu `nextDate` naik. */
export function useRecurringRules(): RecurringRule[] | undefined {
  return useLiveQuery(async () => {
    const rules = await db.recurring.toArray();
    return rules.sort((a, b) => b.active - a.active || (a.nextDate < b.nextDate ? -1 : a.nextDate > b.nextDate ? 1 : 0));
  }, []);
}

export interface DataCountsLive {
  transactions: number;
  accounts: number;
  categories: number;
}

/** Jumlah data untuk layar Data & Backup. */
export function useDataCounts(): DataCountsLive | undefined {
  return useLiveQuery(async () => {
    const [transactions, accounts, categories] = await Promise.all([
      db.transactions.count(),
      db.accounts.count(),
      db.categories.count(),
    ]);
    return { transactions, accounts, categories };
  }, []);
}

/** true jika banner pengingat backup perlu tampil. */
export function useBackupReminder(): boolean | undefined {
  const settings = useSettings();
  const count = useLiveQuery(() => db.transactions.count(), []);
  const today = useToday();
  return useMemo(() => {
    if (!settings || count === undefined || !today) return undefined;
    return shouldShowBackupReminder(settings, count, Date.now(), isStandalone());
  }, [settings, count, today]);
}
