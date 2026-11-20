import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  dayLabel,
  daysInMonth,
  diffDays,
  formatDateLong,
  formatDayHeader,
  isValidLocalDate,
  localDateToDate,
  toLocalDate,
  toLocalIsoString,
  weekdayMon0,
} from './dates';

describe('dates', () => {
  it('berjalan di zona WIB untuk tes', () => {
    expect(new Date(2026, 10, 20).getTimezoneOffset()).toBe(-420);
  });

  it('AC-IN-10 toLocalDate memakai tanggal lokal (05:30 WIB tetap hari itu)', () => {
    const early = new Date(2026, 10, 20, 5, 30);
    expect(early.getUTCDate()).toBe(19);
    expect(toLocalDate(early)).toBe('2026-11-20');
    expect(toLocalDate(new Date(2026, 0, 1, 0, 0, 1))).toBe('2026-01-01');
  });

  it('validasi tanggal termasuk kabisat', () => {
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2027-02-29')).toBe(false);
    expect(isValidLocalDate('2026-11-31')).toBe(false);
    expect(isValidLocalDate('2026-1-01')).toBe(false);
    expect(isValidLocalDate(20261120)).toBe(false);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it('localDateToDate = tengah malam lokal', () => {
    const d = localDateToDate('2026-11-20');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 20, 0]);
  });

  it('addDays melintasi bulan & tahun', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-11-20', -365)).toBe('2025-11-20');
    expect(diffDays('2026-11-20', '2026-11-30')).toBe(10);
  });

  it('addMonthsClamped meng-clamp ke akhir bulan', () => {
    expect(addMonthsClamped('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonthsClamped('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonthsClamped('2026-03-31', -13)).toBe('2025-02-28');
  });

  it('minggu dimulai Senin', () => {
    expect(weekdayMon0('2026-11-02')).toBe(0);
    expect(weekdayMon0('2026-11-08')).toBe(6);
  });

  it('format tampilan Indonesia', () => {
    expect(formatDateLong('2026-11-20')).toBe('Jumat, 20 November 2026');
    expect(formatDayHeader('2026-11-12', '2026-11-20')).toBe('Kam, 12 Nov');
    expect(formatDayHeader('2025-11-12', '2026-11-20')).toBe('Rab, 12 Nov 2025');
    expect(dayLabel('2026-11-20', '2026-11-20')).toBe('Hari ini');
    expect(dayLabel('2026-11-19', '2026-11-20')).toBe('Kemarin');
    expect(dayLabel('2026-12-01', '2026-11-20')).toBe('Terjadwal · Sel, 1 Des');
  });

  it('toLocalIsoString menyertakan offset lokal', () => {
    expect(toLocalIsoString(new Date(2026, 10, 20, 8, 15, 0, 0))).toBe('2026-11-20T08:15:00.000+07:00');
  });
});
