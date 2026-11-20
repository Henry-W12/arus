import type { LocalDate, PeriodKey } from '../db/schema';
import { MONTHS_LONG, MONTHS_SHORT, addDays, addMonthsClamped, diffDays, formatYMD, parseLocalDate } from './dates';

export interface Period {
  /** `YYYY-MM` = bulan dari tanggal akhir. */
  key: PeriodKey;
  start: LocalDate;
  /** Inklusif. */
  end: LocalDate;
}

const KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === 'string' && KEY_RE.test(value);
}

export function clampStartDay(startDay: number): number {
  if (!Number.isInteger(startDay)) return 1;
  return Math.min(28, Math.max(1, startDay));
}

function parseKey(key: PeriodKey): { y: number; m: number } {
  if (!isValidPeriodKey(key)) throw new RangeError(`Kunci periode tidak valid: ${key}`);
  return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) };
}

function makeKey(y: number, m: number): PeriodKey {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** Periode berdasarkan kunci, dengan tanggal mulai `startDay` (1–28). */
export function periodByKey(key: PeriodKey, startDay: number): Period {
  const s = clampStartDay(startDay);
  const { y, m } = parseKey(key);
  const firstOfKey = formatYMD({ y, m, d: 1 });
  if (s === 1) {
    return { key, start: firstOfKey, end: addDays(addMonthsClamped(firstOfKey, 1), -1) };
  }
  return { key, start: addMonthsClamped(formatYMD({ y, m, d: s }), -1), end: formatYMD({ y, m, d: s - 1 }) };
}

/** Periode yang memuat tanggal `date`. */
export function periodOf(date: LocalDate, startDay: number): Period {
  const s = clampStartDay(startDay);
  const { y, m, d } = parseLocalDate(date);
  if (s === 1 || d < s) return periodByKey(makeKey(y, m), s);
  const next = addMonthsClamped(formatYMD({ y, m, d: 1 }), 1);
  return periodByKey(next.slice(0, 7), s);
}

export function shiftPeriod(key: PeriodKey, n: number): PeriodKey {
  const { y, m } = parseKey(key);
  return addMonthsClamped(formatYMD({ y, m, d: 1 }), n).slice(0, 7);
}

/** `n` periode berurutan yang berakhir di `key` (paling lama dulu). */
export function lastPeriods(key: PeriodKey, n: number): PeriodKey[] {
  return Array.from({ length: n }, (_, i) => shiftPeriod(key, i - n + 1));
}

export function isDateInPeriod(date: LocalDate, period: Period): boolean {
  return date >= period.start && date <= period.end;
}

/** "November 2026" */
export function formatPeriodLabel(key: PeriodKey): string {
  const { y, m } = parseKey(key);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "Nov 2026" (label chart). */
export function formatPeriodShort(key: PeriodKey): string {
  const { y, m } = parseKey(key);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "25 Okt – 24 Nov" (tahun disertakan jika rentang melewati pergantian tahun). */
export function formatPeriodRange(period: Period): string {
  const a = parseLocalDate(period.start);
  const b = parseLocalDate(period.end);
  const left = `${a.d} ${MONTHS_SHORT[a.m - 1]}${a.y !== b.y ? ` ${a.y}` : ''}`;
  const right = `${b.d} ${MONTHS_SHORT[b.m - 1]}${a.y !== b.y ? ` ${b.y}` : ''}`;
  return `${left} – ${right}`;
}

/** Jumlah hari dari `today` (inklusif) sampai akhir periode. 0 jika periode sudah lewat. */
export function daysRemaining(today: LocalDate, period: Period): number {
  if (today > period.end) return 0;
  const from = today < period.start ? period.start : today;
  return diffDays(from, period.end) + 1;
}

export function periodLength(period: Period): number {
  return diffDays(period.start, period.end) + 1;
}
