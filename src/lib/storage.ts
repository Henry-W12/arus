import { setSetting } from '../db/repo';
import type { Settings } from '../db/schema';

const DAY_MS = 86_400_000;

/**
 * Minta penyimpanan permanen (dipanggil tiap start, PRD §5.12) dan simpan hasilnya ke `persistGranted`.
 * Mengembalikan `null` jika API tidak tersedia.
 */
export async function ensurePersistentStorage(): Promise<boolean | null> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.persist || !storage.persisted) return null;
  try {
    const granted = (await storage.persisted()) || (await storage.persist());
    await setSetting('persistGranted', granted);
    return granted;
  } catch {
    return null;
  }
}

export interface StorageUsage {
  usage: number;
  quota: number;
}

export async function getStorageEstimate(): Promise<StorageUsage | null> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/** "1,2 MB" */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const text = i === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',');
  return `${text} ${units[i]}`;
}

/** App dibuka sebagai PWA Home Screen? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Bagikan file lewat share sheet iOS (`navigator.share({files})`), fallback `<a download>`.
 * Panggil langsung dari handler tap. `cancelled` jika pengguna membatalkan (AbortError).
 */
export async function shareOrDownloadFile(file: File): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'downloaded';
}

/**
 * Tampilkan pengingat backup? (PRD §5.8): reminder aktif, sudah ≥ N hari (atau belum pernah dan ≥ 20 transaksi),
 * ada transaksi baru sejak backup terakhir, dan tidak sedang di-"Nanti". Jika storage tidak permanen di standalone,
 * interval dipaksa maks. 7 hari.
 */
export function shouldShowBackupReminder(
  settings: Pick<Settings, 'backupReminderDays' | 'lastBackupAt' | 'txCountAtLastBackup' | 'backupReminderSnoozedUntil' | 'persistGranted'>,
  txCount: number,
  now: number,
  standalone = false,
): boolean {
  if (settings.backupReminderDays === 0) return false;
  if (settings.backupReminderSnoozedUntil !== null && now < settings.backupReminderSnoozedUntil) return false;
  if (txCount === settings.txCountAtLastBackup) return false;
  const days = settings.persistGranted === false && standalone ? Math.min(7, settings.backupReminderDays) : settings.backupReminderDays;
  if (settings.lastBackupAt === null) return txCount >= 20;
  return now - settings.lastBackupAt >= days * DAY_MS;
}

/** "Nanti" pada banner backup: sembunyikan 24 jam. */
export function snoozeBackupReminder(now: number = Date.now()): Promise<void> {
  return setSetting('backupReminderSnoozedUntil', now + DAY_MS);
}

/** Teks status backup: "Belum pernah", "Hari ini", "Kemarin", "3 hari lalu". */
export function describeLastBackup(lastBackupAt: number | null, now: number = Date.now()): string {
  if (lastBackupAt === null) return 'Belum pernah';
  const startOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(now) - startOf(lastBackupAt)) / DAY_MS);
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}
