import { MAX_AMOUNT } from '../db/schema';

export const MINUS = '\u2212';
export const NBSP = '\u00A0';
export const MAX_AMOUNT_DIGITS = 12;

/**
 * - `negative` (default): "−" hanya untuk nilai negatif.
 * - `always`: "+" untuk positif, "−" untuk negatif (income/delta).
 * - `none`: nilai mutlak tanpa tanda.
 */
export type SignMode = 'negative' | 'always' | 'none';

export function groupThousands(n: number): string {
  return String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function signPrefix(n: number, sign: SignMode): string {
  if (sign === 'none' || n === 0) return '';
  if (n < 0) return MINUS;
  return sign === 'always' ? '+' : '';
}

/** `Rp 1.250.000`, `−Rp 25.000`, `+Rp 8.500.000` (spasi = U+00A0). */
export function formatIDR(n: number, sign: SignMode = 'negative'): string {
  return `${signPrefix(n, sign)}Rp${NBSP}${groupThousands(n)}`;
}

/** Angka saja dengan pemisah ribuan: `1.250.000`. */
export function formatNumber(n: number): string {
  return `${n < 0 ? MINUS : ''}${groupThousands(n)}`;
}

const SHORT_UNITS: ReadonlyArray<{ size: number; suffix: string }> = [
  { size: 1_000_000_000, suffix: 'M' },
  { size: 1_000_000, suffix: 'jt' },
  { size: 1_000, suffix: 'rb' },
];

/** Format singkat dipotong ke 1 desimal: `950`, `25rb`, `1,5rb`, `1,2jt`, `1,2M`. */
export function formatIDRShort(n: number, options: { withRp?: boolean; sign?: SignMode } = {}): string {
  const abs = Math.trunc(Math.abs(n));
  const unit = SHORT_UNITS.find((u) => abs >= u.size);
  let body: string;
  if (!unit) {
    body = String(abs);
  } else {
    const tenths = Math.floor((abs * 10) / unit.size);
    const whole = Math.floor(tenths / 10);
    const dec = tenths % 10;
    body = `${groupThousands(whole)}${dec ? `,${dec}` : ''}${unit.suffix}`;
  }
  return `${signPrefix(n, options.sign ?? 'negative')}${options.withRp ? `Rp${NBSP}` : ''}${body}`;
}

/** Persen bulat: `64%`, `<1%` untuk 0 < x < 1%. `ratio` = 0..n. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%';
  const pct = ratio * 100;
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

const AMOUNT_TEXT_RE = /^(\d[\d.,]*)(rb|k|jt|m)?$/;
const SUFFIX_SIZE: Record<string, number> = { rb: 1_000, k: 1_000, jt: 1_000_000, m: 1_000_000_000 };

/**
 * Parse teks nominal (pencarian): `25rb`, `25k`, `25.000`, `1,2jt`, `1.2jt`, `Rp 50.000` → integer.
 * Mengembalikan `null` jika bukan nominal yang valid.
 */
export function parseAmountText(input: string): number | null {
  const text = input.toLowerCase().replace(/rp/g, '').replace(/[\s\u00A0]/g, '');
  const match = AMOUNT_TEXT_RE.exec(text);
  if (!match) return null;
  const [, numPart, suffix] = match;
  const separators = numPart.match(/[.,]/g) ?? [];
  let intDigits: string;
  let fracDigits = '';

  if (suffix && separators.length === 1) {
    const [a, b] = numPart.split(/[.,]/);
    if (!b) return null;
    intDigits = a;
    fracDigits = b;
  } else if (separators.length > 0) {
    const groups = numPart.split(/[.,]/);
    if (groups[0].length === 0 || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3)) return null;
    intDigits = groups.join('');
  } else {
    intDigits = numPart;
  }

  const size = suffix ? SUFFIX_SIZE[suffix] : 1;
  const fracScale = 10 ** fracDigits.length;
  if (fracDigits && size % fracScale !== 0) return null;
  const value = Number(intDigits) * size + (fracDigits ? Number(fracDigits) * (size / fracScale) : 0);
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) return null;
  return value;
}

export function isValidAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= MAX_AMOUNT;
}

export function isValidAdjustmentAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n !== 0 && Math.abs(n) <= MAX_AMOUNT;
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'backspace' | 'clear';

export interface KeypadResult {
  value: number;
  /** true jika input ditolak karena sudah 12 digit (UI: animasi "geleng"). */
  rejected: boolean;
}

/** Terapkan satu tombol keypad ke nominal saat ini (PRD §4.3). */
export function applyKeypad(value: number, key: KeypadKey): KeypadResult {
  const digits = value > 0 ? String(value) : '';
  if (key === 'clear') return { value: 0, rejected: false };
  if (key === 'backspace') {
    const next = digits.slice(0, -1);
    return { value: next ? Number(next) : 0, rejected: false };
  }
  if (!digits && (key === '0' || key === '000')) return { value: 0, rejected: false };
  const room = MAX_AMOUNT_DIGITS - digits.length;
  if (room <= 0) return { value, rejected: true };
  const added = key.slice(0, room);
  return { value: Number(digits + added), rejected: false };
}

/** Nominal → teks tampilan keypad: `1.250.000` (tanpa "Rp"), `0` jika kosong. */
export function formatKeypadDisplay(value: number): string {
  return groupThousands(value);
}
