import type { Account, ID, LocalDate, Transaction } from '../db/schema';

export type BalanceMap = Map<ID, number>;

/** Efek bertanda satu transaksi terhadap saldo akun tertentu (0 jika tidak terkait). */
export function transactionEffect(tx: Transaction, accountId: ID): number {
  switch (tx.type) {
    case 'income':
      return tx.accountId === accountId ? tx.amount : 0;
    case 'expense':
      return tx.accountId === accountId ? -tx.amount : 0;
    case 'adjustment':
      return tx.accountId === accountId ? tx.amount : 0;
    case 'transfer': {
      let effect = 0;
      if (tx.accountId === accountId) effect -= tx.amount;
      if (tx.toAccountId === accountId) effect += tx.amount;
      return effect;
    }
  }
}

/**
 * Saldo setiap akun = openingBalance + Σ efek transaksi (PRD §2).
 * `asOf` = hanya transaksi dengan `date ≤ asOf` (saldo hari ini). Tanpa `asOf` = termasuk terjadwal.
 */
export function computeBalances(accounts: readonly Account[], txs: readonly Transaction[], asOf?: LocalDate): BalanceMap {
  const balances: BalanceMap = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  for (const tx of txs) {
    if (asOf !== undefined && tx.date > asOf) continue;
    const from = balances.get(tx.accountId);
    if (tx.type === 'transfer') {
      if (from !== undefined) balances.set(tx.accountId, from - tx.amount);
      if (tx.toAccountId !== undefined) {
        const to = balances.get(tx.toAccountId);
        if (to !== undefined) balances.set(tx.toAccountId, to + tx.amount);
      }
    } else if (from !== undefined) {
      balances.set(tx.accountId, from + (tx.type === 'expense' ? -tx.amount : tx.amount));
    }
  }
  return balances;
}

/** Total saldo = Σ akun aktif dengan `includeInTotal=1`. */
export function totalBalance(accounts: readonly Account[], balances: BalanceMap): number {
  let total = 0;
  for (const a of accounts) {
    if (a.archived === 0 && a.includeInTotal === 1) total += balances.get(a.id) ?? 0;
  }
  return total;
}

/** Urutan kronologis stabil: tanggal naik, lalu `createdAt` naik. */
export function compareChronological(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Urutan tampilan daftar: tanggal turun, lalu `createdAt` turun. */
export function compareNewestFirst(a: Transaction, b: Transaction): number {
  return -compareChronological(a, b);
}

/** Saldo akun setelah setiap transaksi yang menyentuhnya (detail akun). Key = id transaksi. */
export function runningBalances(account: Account, txs: readonly Transaction[]): Map<ID, number> {
  const related = txs
    .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
    .sort(compareChronological);
  const result = new Map<ID, number>();
  let balance = account.openingBalance;
  for (const tx of related) {
    balance += transactionEffect(tx, account.id);
    result.set(tx.id, balance);
  }
  return result;
}

/** Selisih penyesuaian yang perlu dicatat agar saldo = `actual`. */
export function adjustmentDelta(currentBalance: number, actual: number): number {
  return actual - currentBalance;
}
