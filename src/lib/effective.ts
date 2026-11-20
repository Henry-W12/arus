import type { LocalDate, Transaction } from '../db/schema';

/*
 * Aturan tunggal transaksi Terjadwal (PRD §5.1): transaksi baru "berlaku" pada tanggalnya.
 * Transaksi dengan `date > hari ini` tetap tampil (grup "Terjadwal"), tetapi TIDAK dihitung di
 * saldo, total periode, ringkasan, tren, anggaran, maupun jumlah hasil pencarian.
 * Semua agregasi wajib memakai helper ini (jangan menulis `t.date <= today` sendiri).
 */

/** true jika transaksi sudah berlaku per `today` (inklusif). */
export function isEffective(tx: Pick<Transaction, 'date'>, today: LocalDate): boolean {
  return tx.date <= today;
}

/** Hanya transaksi yang sudah berlaku per `today`. */
export function effectiveOnly<T extends Pick<Transaction, 'date'>>(txs: readonly T[], today: LocalDate): T[] {
  return txs.filter((t) => isEffective(t, today));
}

/** true jika transaksi masih terjadwal (tanggal di masa depan). */
export function isScheduled(tx: Pick<Transaction, 'date'>, today: LocalDate): boolean {
  return !isEffective(tx, today);
}
