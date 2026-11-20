import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../db/schema';
import { describeLastBackup, formatBytes, shouldShowBackupReminder } from './storage';

const DAY = 86_400_000;
const base = { ...DEFAULT_SETTINGS, backupReminderDays: 14 as const, lastBackupAt: 0, txCountAtLastBackup: 10 };

describe('pengingat backup (AC-BK-08)', () => {
  it('muncul jika ≥ N hari dan ada transaksi baru', () => {
    expect(shouldShowBackupReminder(base, 11, 14 * DAY)).toBe(true);
    expect(shouldShowBackupReminder(base, 11, 13 * DAY)).toBe(false);
    expect(shouldShowBackupReminder(base, 10, 30 * DAY)).toBe(false);
  });

  it('mati jika setting 0; "Nanti" menyembunyikan', () => {
    expect(shouldShowBackupReminder({ ...base, backupReminderDays: 0 }, 99, 99 * DAY)).toBe(false);
    expect(shouldShowBackupReminder({ ...base, backupReminderSnoozedUntil: 31 * DAY }, 99, 30 * DAY)).toBe(false);
    expect(shouldShowBackupReminder({ ...base, backupReminderSnoozedUntil: 31 * DAY }, 99, 32 * DAY)).toBe(true);
  });

  it('belum pernah backup → butuh ≥ 20 transaksi', () => {
    const never = { ...base, lastBackupAt: null, txCountAtLastBackup: 0 };
    expect(shouldShowBackupReminder(never, 19, 0)).toBe(false);
    expect(shouldShowBackupReminder(never, 20, 0)).toBe(true);
  });

  it('storage tidak permanen di standalone → dipaksa 7 hari', () => {
    const s = { ...base, persistGranted: false };
    expect(shouldShowBackupReminder(s, 11, 7 * DAY, true)).toBe(true);
    expect(shouldShowBackupReminder(s, 11, 7 * DAY, false)).toBe(false);
  });

  it('teks status', () => {
    const now = new Date(2026, 10, 20, 10).getTime();
    expect(describeLastBackup(null, now)).toBe('Belum pernah');
    expect(describeLastBackup(new Date(2026, 10, 20, 1).getTime(), now)).toBe('Hari ini');
    expect(describeLastBackup(new Date(2026, 10, 19, 23).getTime(), now)).toBe('Kemarin');
    expect(describeLastBackup(new Date(2026, 10, 17, 9).getTime(), now)).toBe('3 hari lalu');
    expect(formatBytes(1_258_291)).toBe('1,2 MB');
  });
});
