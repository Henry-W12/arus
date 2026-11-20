import { backupFileName, buildBackup, countsOf, serializeBackup, type BackupCounts, type BackupData, type BackupFile } from '../lib/backup';
import { buildCsv, csvFileName, filterByDateRange } from '../lib/csv';
import { toLocalDate, todayLocal } from '../lib/dates';
import type { LocalDate } from './schema';
import { DEVICE_ONLY_SETTING_KEYS } from './schema';
import { db } from './db';
import { runRecurring, type RunRecurringResult } from './repo';

/** Baca seluruh isi DB (snapshot konsisten dalam satu transaksi baca). */
export async function readAllData(): Promise<BackupData> {
  return db.transaction('r', db.allTables, async () => {
    const [accounts, categories, transactions, budgets, recurring, templates, settings] = await Promise.all([
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.recurring.toArray(),
      db.templates.toArray(),
      db.settings.toArray(),
    ]);
    return { accounts, categories, transactions, budgets, recurring, templates, settings };
  });
}

/** Objek backup siap diserialisasi (tanpa PIN & setting khusus perangkat). */
export async function createBackup(now: Date = new Date()): Promise<BackupFile> {
  return buildBackup(await readAllData(), now);
}

/** `File` JSON `arus-backup-YYYY-MM-DD.json` untuk `navigator.share({files})`. */
export async function createBackupFile(now: Date = new Date()): Promise<File> {
  const backup = await createBackup(now);
  return new File([serializeBackup(backup)], backupFileName(toLocalDate(now)), { type: 'application/json' });
}

/** Panggil HANYA setelah share/download berhasil (bukan saat dibatalkan). */
export async function markBackupDone(now: number = Date.now()): Promise<void> {
  const count = await db.transactions.count();
  await db.settings.bulkPut([
    { key: 'lastBackupAt', value: now },
    { key: 'txCountAtLastBackup', value: count },
    { key: 'backupReminderSnoozedUntil', value: null },
  ]);
}

export interface RestorePreview {
  exportedAt: string;
  backup: BackupCounts;
  current: BackupCounts;
}

export async function previewRestore(backup: BackupFile): Promise<RestorePreview> {
  return { exportedAt: backup.exportedAt, backup: backup.counts, current: countsOf(await readAllData()) };
}

/**
 * Restore "ganti semua data" secara atomik: clear + bulkAdd dalam satu transaksi.
 * Jika gagal, transaksi di-rollback dan data lama utuh. `backup` harus hasil `parseBackup` yang ok.
 * Setting khusus perangkat (PIN, status persist, dll.) dipertahankan.
 */
export async function restoreBackup(backup: BackupFile, today: LocalDate = todayLocal()): Promise<RunRecurringResult> {
  const { data } = backup;
  await db.transaction('rw', db.allTables, async () => {
    const keep = await db.settings.bulkGet([...DEVICE_ONLY_SETTING_KEYS]);
    await Promise.all(db.allTables.map((t) => t.clear()));
    await db.accounts.bulkAdd(data.accounts);
    await db.categories.bulkAdd(data.categories);
    await db.transactions.bulkAdd(data.transactions);
    await db.budgets.bulkAdd(data.budgets);
    await db.recurring.bulkAdd(data.recurring);
    await db.templates.bulkAdd(data.templates);
    await db.settings.bulkPut(data.settings);
    await db.settings.bulkPut(keep.filter((row) => row !== undefined));
    if (!data.settings.some((s) => s.key === 'seededAt')) await db.settings.put({ key: 'seededAt', value: Date.now() });
  });
  return runRecurring(today);
}

export type CsvRange = { kind: 'all' } | { kind: 'range'; from: LocalDate; to: LocalDate; label: string };

/** CSV transaksi sebagai `File` (bukan backup; tidak memengaruhi `lastBackupAt`). */
export async function createCsvFile(range: CsvRange): Promise<File> {
  const [txs, categories, accounts] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
  ]);
  const rows = range.kind === 'all' ? txs : filterByDateRange(txs, range.from, range.to);
  const name = csvFileName(range.kind === 'all' ? 'semua' : range.label);
  return new File([buildCsv(rows, categories, accounts)], name, { type: 'text/csv;charset=utf-8' });
}
