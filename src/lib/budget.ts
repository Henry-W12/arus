import type { Budget, Category, ID, LocalDate, PeriodKey, Transaction } from '../db/schema';
import { daysRemaining, isDateInPeriod, type Period } from './period';

export type BudgetStatus = 'normal' | 'warning' | 'over';

/** Record yang berlaku pada periode P = `startPeriod` terbesar ≤ P (PRD §5.5). */
export function effectiveBudgetRecord(budgets: readonly Budget[], categoryId: ID, key: PeriodKey): Budget | null {
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.categoryId !== categoryId || b.startPeriod > key) continue;
    if (!best || b.startPeriod > best.startPeriod || (b.startPeriod === best.startPeriod && b.updatedAt > best.updatedAt)) {
      best = b;
    }
  }
  return best;
}

/** Nominal anggaran yang berlaku, atau `null` jika tidak ada / dihapus (amount 0). */
export function effectiveBudget(budgets: readonly Budget[], categoryId: ID, key: PeriodKey): number | null {
  const record = effectiveBudgetRecord(budgets, categoryId, key);
  return record && record.amount > 0 ? record.amount : null;
}

/** <80% normal, 80–100% warning, >100% over. */
export function budgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget <= 0) return 'over';
  const ratio = spent / budget;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

/** Sisa per hari = max(0, sisa) / hari tersisa, dibulatkan ke bawah ke ribuan. */
export function dailyAllowance(remaining: number, today: LocalDate, period: Period): number {
  const days = daysRemaining(today, period);
  if (days <= 0) return 0;
  return Math.floor(Math.max(0, remaining) / days / 1000) * 1000;
}

export interface BudgetLine {
  categoryId: ID;
  budget: number;
  spent: number;
  /** Boleh negatif. */
  remaining: number;
  /** spent / budget. */
  ratio: number;
  status: BudgetStatus;
}

export interface UnbudgetedLine {
  categoryId: ID;
  spent: number;
}

export interface BudgetOverview {
  period: Period;
  lines: BudgetLine[];
  unbudgeted: UnbudgetedLine[];
  total: { budget: number; spent: number; remaining: number; ratio: number; status: BudgetStatus } | null;
  /** Hanya pada periode berjalan; `null` untuk periode lampau. */
  perDay: { amount: number; daysLeft: number } | null;
}

/**
 * Progres anggaran satu periode. Kategori diarsipkan hanya tampil pada periode lampau
 * atau jika masih punya pengeluaran di periode itu.
 */
export function budgetOverview(params: {
  budgets: readonly Budget[];
  categories: readonly Category[];
  transactions: readonly Transaction[];
  period: Period;
  currentKey: PeriodKey;
  today: LocalDate;
}): BudgetOverview {
  const { budgets, categories, transactions, period, currentKey, today } = params;
  const spentBy = new Map<ID, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.categoryId || !isDateInPeriod(tx.date, period)) continue;
    spentBy.set(tx.categoryId, (spentBy.get(tx.categoryId) ?? 0) + tx.amount);
  }

  const isPast = period.key < currentKey;
  const lines: BudgetLine[] = [];
  const unbudgeted: UnbudgetedLine[] = [];
  const expenseCats = categories.filter((c) => c.kind === 'expense').sort((a, b) => a.sortOrder - b.sortOrder);

  for (const cat of expenseCats) {
    const spent = spentBy.get(cat.id) ?? 0;
    if (cat.archived === 1 && !isPast && spent === 0) continue;
    const budget = effectiveBudget(budgets, cat.id, period.key);
    if (budget !== null) {
      lines.push({
        categoryId: cat.id,
        budget,
        spent,
        remaining: budget - spent,
        ratio: spent / budget,
        status: budgetStatus(spent, budget),
      });
    } else if (spent > 0) {
      unbudgeted.push({ categoryId: cat.id, spent });
    }
  }
  unbudgeted.sort((a, b) => b.spent - a.spent);

  let total: BudgetOverview['total'] = null;
  if (lines.length > 0) {
    const budget = lines.reduce((s, l) => s + l.budget, 0);
    const spent = lines.reduce((s, l) => s + l.spent, 0);
    total = { budget, spent, remaining: budget - spent, ratio: spent / budget, status: budgetStatus(spent, budget) };
  }

  const isCurrent = period.key === currentKey;
  const perDay =
    isCurrent && total
      ? { amount: dailyAllowance(total.remaining, today, period), daysLeft: daysRemaining(today, period) }
      : null;

  return { period, lines, unbudgeted, total, perDay };
}
