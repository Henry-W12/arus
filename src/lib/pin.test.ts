import { describe, expect, it } from 'vitest';
import { hashPin, lockDurationMs, nextPinLockState, pinLockRemainingMs, shouldLockOnResume, verifyPin } from './pin';

describe('PIN', () => {
  it('AC-PN-04 hash + salt, tidak menyimpan PIN; verifikasi', async () => {
    const record = await hashPin('123456', 1000);
    expect(record.iterations).toBe(1000);
    expect(JSON.stringify(record)).not.toContain('123456');
    expect(await verifyPin('123456', record)).toBe(true);
    expect(await verifyPin('123457', record)).toBe(false);
    expect(await verifyPin('12345', record)).toBe(false);
    const again = await hashPin('123456', 1000);
    expect(again.salt).not.toBe(record.salt);
    expect(again.hash).not.toBe(record.hash);
  });

  it('default 150.000 iterasi PBKDF2', async () => {
    expect((await hashPin('000000')).iterations).toBe(150_000);
    await expect(hashPin('12a456')).rejects.toThrow();
  });

  it('AC-PN-03 salah 5× → 30 dtk, berlipat tiap 5 kesalahan, maks 15 menit', () => {
    expect([4, 5, 6, 10, 15, 20, 40, 100].map(lockDurationMs)).toEqual([
      0, 30_000, 0, 60_000, 120_000, 240_000, 900_000, 900_000,
    ]);
    let state = { failures: 0, lockedUntil: null as number | null };
    for (let i = 0; i < 5; i++) state = nextPinLockState(state, false, 1_000);
    expect(state).toEqual({ failures: 5, lockedUntil: 31_000 });
    expect(pinLockRemainingMs(state, 11_000)).toBe(20_000);
    expect(pinLockRemainingMs(state, 31_000)).toBe(0);
    expect(nextPinLockState(state, true, 40_000)).toEqual({ failures: 0, lockedUntil: null });
  });

  it('AC-PN-02 auto-lock', () => {
    expect(shouldLockOnResume(0, 30_000, 1)).toBe(false);
    expect(shouldLockOnResume(0, 70_000, 1)).toBe(true);
    expect(shouldLockOnResume(0, 1, 0)).toBe(true);
    expect(shouldLockOnResume(null, 1e9, 1)).toBe(false);
  });
});
