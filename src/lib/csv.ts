import type { Account, Category, ID, LocalDate, Transaction, TransactionType } from '../db/schema';
import { compareChronological } from './balances';

const BOM = '\uFEFF';
const CRLF = '\r\n';

export const CSV_HEADERS = ['Tanggal', 'Jenis', 'Nominal', 'Kategori', 'Akun', 'Akun Tujuan', 'Catatan'] as const;

const TYPE_LABEL: Record<TransactionType, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
};

/** Quoting RFC 4180: bungkus kutip jika ada koma, kutip, atau baris baru. */
export function csvField(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Nominal bertanda: negatif untuk pengeluaran dan transfer (keluar dari akun asal). */
export function csvSignedAmount(tx: Transaction): number {
  if (tx.type === 'expense' || tx.type === 'transfer') return -tx.amount;
  return tx.amount;
}

/** CSV UTF-8 + BOM, CRLF, urut kronologis (PRD §5.8). */
export function buildCsv(
  txs: readonly Transaction[],
  categories: ReadonlyMap<ID, Pick<Category, 'name'>> | readonly Category[],
  accounts: ReadonlyMap<ID, Pick<Account, 'name'>> | readonly Account[],
): string {
  const cats = toMap(categories);
  const accs = toMap(accounts);
  const rows = [...txs].sort(compareChronological).map((tx) =>
    [
      tx.date,
      TYPE_LABEL[tx.type],
      csvSignedAmount(tx),
      tx.categoryId ? cats.get(tx.categoryId)?.name ?? '' : '',
      accs.get(tx.accountId)?.name ?? '',
      tx.toAccountId ? accs.get(tx.toAccountId)?.name ?? '' : '',
      tx.note ?? '',
    ]
      .map(csvField)
      .join(','),
  );
  return BOM + [CSV_HEADERS.join(','), ...rows].join(CRLF) + CRLF;
}

function toMap<T extends { name: string }>(
  input: ReadonlyMap<ID, T> | readonly (T & { id: ID })[],
): ReadonlyMap<ID, T> {
  return Array.isArray(input) ? new Map(input.map((x) => [x.id, x])) : (input as ReadonlyMap<ID, T>);
}

/** `arus-transaksi-<rentang>.csv`, mis. `arus-transaksi-2026-11.csv` / `arus-transaksi-semua.csv`. */
export function csvFileName(rangeLabel: string): string {
  return `arus-transaksi-${rangeLabel}.csv`;
}

export function filterByDateRange(txs: readonly Transaction[], from?: LocalDate, to?: LocalDate): Transaction[] {
  return txs.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
}
