import type { LocalDate } from '../db/schema';

export interface YMD {
  y: number;
  m: number;
  d: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad2 = (n: number) => String(n).padStart(2, '0');

export const MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;
/** Indeks 0 = Minggu (sesuai `Date#getDay`). */
export const WEEKDAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
export const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function formatYMD({ y, m, d }: YMD): LocalDate {
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
}

/** Tanggal lokal perangkat dari `Date` (getter lokal, tidak pernah `toISOString`). */
export function toLocalDate(date: Date = new Date()): LocalDate {
  return formatYMD({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
}

export function todayLocal(): LocalDate {
  return toLocalDate(new Date());
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseLocalDate(value: LocalDate): YMD {
  if (!isValidLocalDate(value)) throw new RangeError(`Tanggal tidak valid: ${value}`);
  return { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)), d: Number(value.slice(8, 10)) };
}

/** `Date` pada tengah malam lokal (bukan `new Date('YYYY-MM-DD')` yang UTC). */
export function localDateToDate(value: LocalDate): Date {
  const { y, m, d } = parseLocalDate(value);
  return new Date(y, m - 1, d);
}

function dayNumber(value: LocalDate): number {
  const { y, m, d } = parseLocalDate(value);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): LocalDate {
  const dt = new Date(n * DAY_MS);
  return formatYMD({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

export function addDays(value: LocalDate, days: number): LocalDate {
  return fromDayNumber(dayNumber(value) + days);
}

/** Selisih hari `b − a`. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** Tambah bulan; hari di-clamp ke akhir bulan (31 Jan + 1 → 28/29 Feb). */
export function addMonthsClamped(value: LocalDate, months: number, day?: number): LocalDate {
  const { y, m, d } = parseLocalDate(value);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return formatYMD({ y: ny, m: nm, d: Math.min(day ?? d, daysInMonth(ny, nm)) });
}

/** 0 = Senin … 6 = Minggu (minggu dimulai Senin, PRD §5.6). */
export function weekdayMon0(value: LocalDate): number {
  return (localDateToDate(value).getDay() + 6) % 7;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** "Jumat, 20 November 2026" */
export function formatDateLong(value: LocalDate): string {
  const { y, m, d } = parseLocalDate(value);
  return `${WEEKDAYS_LONG[localDateToDate(value).getDay()]}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** "20 Nov 2026" */
export function formatDateMedium(value: LocalDate): string {
  const { y, m, d } = parseLocalDate(value);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "Kam, 20 Nov" (tahun ditambahkan jika berbeda dari `today`). */
export function formatDayHeader(value: LocalDate, today: LocalDate = todayLocal()): string {
  const { y, m, d } = parseLocalDate(value);
  const base = `${WEEKDAYS_SHORT[localDateToDate(value).getDay()]}, ${d} ${MONTHS_SHORT[m - 1]}`;
  return y === parseLocalDate(today).y ? base : `${base} ${y}`;
}

/** Label header grup hari: "Hari ini", "Kemarin", "Terjadwal · Sel, 1 Des", atau "Kam, 12 Nov". */
export function dayLabel(value: LocalDate, today: LocalDate = todayLocal()): string {
  if (value === today) return 'Hari ini';
  if (value > today) return `Terjadwal · ${formatDayHeader(value, today)}`;
  if (value === addDays(today, -1)) return 'Kemarin';
  return formatDayHeader(value, today);
}

/** Waktu lokal ISO 8601 dengan offset, mis. `2026-11-20T08:15:00.000+07:00`. */
export function toLocalIsoString(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return (
    `${toLocalDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${ms}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}
