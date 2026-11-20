import {
  ACCOUNT_NAME_MAX,
  CATEGORY_NAME_MAX,
  MAX_AMOUNT,
  NOTE_MAX,
  TEMPLATE_LABEL_MAX,
  type Account,
  type Budget,
  type Category,
  type RecurringRule,
  type Template,
  type Transaction,
} from '../db/schema';
import { isColorToken, isIconName } from '../db/iconIds';
import { isValidLocalDate } from './dates';
import { isValidAdjustmentAmount, isValidAmount } from './money';
import { isValidPeriodKey } from './period';

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isFlag = (v: unknown) => v === 0 || v === 1;
const isTimestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isOptionalString = (v: unknown) => v === undefined || typeof v === 'string';
const isOptionalId = (v: unknown) => v === undefined || isNonEmptyString(v);

/** Trim catatan; string kosong → undefined. */
export function normalizeNote(note: string | undefined | null): string | undefined {
  const trimmed = (note ?? '').trim();
  return trimmed ? trimmed : undefined;
}

export function nameIssue(name: unknown, max: number): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return 'Nama wajib diisi';
  if (name.trim().length > max) return `Nama maksimal ${max} karakter`;
  return null;
}

function baseIssues(v: UnknownRecord): string[] {
  const issues: string[] = [];
  if (!isNonEmptyString(v.id)) issues.push('id tidak valid');
  if (!isTimestamp(v.createdAt) || !isTimestamp(v.updatedAt)) issues.push('timestamp tidak valid');
  return issues;
}

export function accountIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  const n = nameIssue(value.name, ACCOUNT_NAME_MAX);
  if (n) issues.push(n);
  if (!['cash', 'bank', 'ewallet', 'other'].includes(String(value.type))) issues.push('jenis akun tidak valid');
  if (!isIconName(value.icon)) issues.push('ikon tidak valid');
  if (!isColorToken(value.color)) issues.push('warna tidak valid');
  if (!isInt(value.openingBalance) || Math.abs(value.openingBalance) > MAX_AMOUNT) issues.push('saldo awal tidak valid');
  if (!isFlag(value.includeInTotal) || !isFlag(value.archived)) issues.push('flag tidak valid');
  if (!isInt(value.sortOrder)) issues.push('urutan tidak valid');
  return issues;
}

export function categoryIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  const n = nameIssue(value.name, CATEGORY_NAME_MAX);
  if (n) issues.push(n);
  if (value.kind !== 'expense' && value.kind !== 'income') issues.push('jenis kategori tidak valid');
  if (!isIconName(value.icon)) issues.push('ikon tidak valid');
  if (!isColorToken(value.color)) issues.push('warna tidak valid');
  if (!isFlag(value.archived)) issues.push('flag tidak valid');
  if (!isInt(value.sortOrder)) issues.push('urutan tidak valid');
  return issues;
}

/** Validasi bentuk + aturan per-jenis transaksi (tanpa cek referensi). */
export function transactionIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  const type = value.type;
  if (!['expense', 'income', 'transfer', 'adjustment'].includes(String(type))) {
    issues.push('jenis transaksi tidak valid');
    return issues;
  }
  const amountOk = type === 'adjustment' ? isValidAdjustmentAmount(value.amount) : isValidAmount(value.amount);
  if (!amountOk) issues.push('nominal tidak valid');
  if (!isValidLocalDate(value.date)) issues.push('tanggal tidak valid');
  if (!isNonEmptyString(value.accountId)) issues.push('akun wajib diisi');
  if (!isOptionalString(value.note) || (typeof value.note === 'string' && value.note.length > NOTE_MAX)) {
    issues.push(`catatan maksimal ${NOTE_MAX} karakter`);
  }
  if (!isOptionalId(value.recurringId)) issues.push('recurringId tidak valid');
  if (type === 'transfer') {
    if (!isNonEmptyString(value.toAccountId)) issues.push('akun tujuan wajib diisi');
    else if (value.toAccountId === value.accountId) issues.push('akun asal dan tujuan sama');
    if (value.categoryId !== undefined) issues.push('transfer tidak memakai kategori');
  } else {
    if (value.toAccountId !== undefined) issues.push('akun tujuan hanya untuk transfer');
    if (type === 'adjustment') {
      if (value.categoryId !== undefined) issues.push('penyesuaian tidak memakai kategori');
    } else if (!isNonEmptyString(value.categoryId)) {
      issues.push('kategori wajib diisi');
    }
  }
  return issues;
}

export function budgetIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  if (!isNonEmptyString(value.categoryId)) issues.push('kategori wajib diisi');
  if (!(value.amount === 0 || isValidAmount(value.amount))) issues.push('nominal tidak valid');
  if (!isValidPeriodKey(value.startPeriod)) issues.push('periode tidak valid');
  return issues;
}

export function recurringIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  const type = value.type;
  if (type !== 'expense' && type !== 'income' && type !== 'transfer') issues.push('jenis tidak valid');
  if (!isValidAmount(value.amount)) issues.push('nominal tidak valid');
  if (!isNonEmptyString(value.accountId)) issues.push('akun wajib diisi');
  if (type === 'transfer') {
    if (!isNonEmptyString(value.toAccountId)) issues.push('akun tujuan wajib diisi');
    else if (value.toAccountId === value.accountId) issues.push('akun asal dan tujuan sama');
    if (value.categoryId !== undefined) issues.push('transfer tidak memakai kategori');
  } else {
    if (!isNonEmptyString(value.categoryId)) issues.push('kategori wajib diisi');
    if (value.toAccountId !== undefined) issues.push('akun tujuan hanya untuk transfer');
  }
  if (!isOptionalString(value.note) || (typeof value.note === 'string' && value.note.length > NOTE_MAX)) {
    issues.push(`catatan maksimal ${NOTE_MAX} karakter`);
  }
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(String(value.frequency))) issues.push('frekuensi tidak valid');
  if (!isInt(value.interval) || value.interval < 1 || value.interval > 12) issues.push('interval harus 1–12');
  if (!isValidLocalDate(value.anchorDate)) issues.push('tanggal mulai tidak valid');
  if (value.endDate !== undefined) {
    if (!isValidLocalDate(value.endDate)) issues.push('tanggal berakhir tidak valid');
    else if (isValidLocalDate(value.anchorDate) && value.endDate < value.anchorDate) {
      issues.push('tanggal berakhir sebelum tanggal mulai');
    }
  }
  if (!isInt(value.generatedCount) || value.generatedCount < 0) issues.push('generatedCount tidak valid');
  if (!isValidLocalDate(value.nextDate)) issues.push('nextDate tidak valid');
  if (!isFlag(value.active)) issues.push('flag tidak valid');
  return issues;
}

export function templateIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['bukan objek'];
  const issues = baseIssues(value);
  const n = nameIssue(value.label, TEMPLATE_LABEL_MAX);
  if (n) issues.push(n.replace('Nama', 'Label'));
  if (value.type !== 'expense' && value.type !== 'income') issues.push('jenis tidak valid');
  if (!isValidAmount(value.amount)) issues.push('nominal tidak valid');
  if (!isNonEmptyString(value.categoryId)) issues.push('kategori wajib diisi');
  if (!isOptionalId(value.accountId)) issues.push('akun tidak valid');
  if (!isOptionalString(value.note) || (typeof value.note === 'string' && value.note.length > NOTE_MAX)) {
    issues.push(`catatan maksimal ${NOTE_MAX} karakter`);
  }
  if (!isInt(value.sortOrder) || !isInt(value.useCount) || value.useCount < 0) issues.push('urutan tidak valid');
  return issues;
}

export type EntityGuard<T> = (value: unknown) => value is T;

function guard<T>(issuesFn: (v: unknown) => string[]): EntityGuard<T> {
  return (value: unknown): value is T => issuesFn(value).length === 0;
}

export const isAccount = guard<Account>(accountIssues);
export const isCategory = guard<Category>(categoryIssues);
export const isTransaction = guard<Transaction>(transactionIssues);
export const isBudget = guard<Budget>(budgetIssues);
export const isRecurringRule = guard<RecurringRule>(recurringIssues);
export const isTemplate = guard<Template>(templateIssues);

/** Nama unik case-insensitive (setelah trim). */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('id-ID') === b.trim().toLocaleLowerCase('id-ID');
}
