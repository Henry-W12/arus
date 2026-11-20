import type { AutoLockMinutes, PinLockState, PinRecord } from '../db/schema';

export const PIN_LENGTH = 6;
export const PIN_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const FAILS_PER_STEP = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Hash PIN dengan PBKDF2-SHA-256 + salt acak 16 byte (PRD §5.9). */
export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<PinRecord> {
  if (!isValidPin(pin)) throw new RangeError('PIN harus 6 digit');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, iterations);
  return { hash: toBase64(hash), salt: toBase64(salt), iterations };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const actual = await derive(pin, fromBase64(record.salt), record.iterations);
  const expected = fromBase64(record.hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/** Lama kunci setelah `failures` kesalahan: 5→30 dtk, 10→60, 15→120 … maks. 15 menit. */
export function lockDurationMs(failures: number): number {
  if (failures < FAILS_PER_STEP || failures % FAILS_PER_STEP !== 0) return 0;
  const step = failures / FAILS_PER_STEP - 1;
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** step);
}

/** State penghitung setelah satu percobaan PIN. */
export function nextPinLockState(state: PinLockState, success: boolean, now: number): PinLockState {
  if (success) return { failures: 0, lockedUntil: null };
  const failures = state.failures + 1;
  const duration = lockDurationMs(failures);
  return { failures, lockedUntil: duration ? now + duration : state.lockedUntil };
}

/** Sisa ms masa tunggu (0 = boleh mencoba). */
export function pinLockRemainingMs(state: PinLockState, now: number): number {
  return state.lockedUntil && state.lockedUntil > now ? state.lockedUntil - now : 0;
}

/** Perlu dikunci saat kembali dari background? `hiddenAt` = epoch ms saat `visibilitychange → hidden`. */
export function shouldLockOnResume(hiddenAt: number | null, now: number, autoLockMinutes: AutoLockMinutes): boolean {
  if (hiddenAt === null) return false;
  if (autoLockMinutes === 0) return true;
  return now - hiddenAt >= autoLockMinutes * 60_000;
}
