import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  daysRemaining,
  formatPeriodLabel,
  formatPeriodRange,
  lastPeriods,
  periodByKey,
  periodOf,
  shiftPeriod,
} from './period';

describe('periode bulan', () => {
  it('AC-PR-01 S=1', () => {
    expect(periodOf('2026-11-20', 1)).toEqual({ key: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    expect(periodOf('2028-02-29', 1)).toEqual({ key: '2028-02', start: '2028-02-01', end: '2028-02-29' });
  });

  it('AC-PR-02 S=25 (gajian) termasuk lintas tahun', () => {
    expect(periodOf('2026-11-24', 25)).toEqual({ key: '2026-11', start: '2026-10-25', end: '2026-11-24' });
    expect(periodOf('2026-11-25', 25)).toEqual({ key: '2026-12', start: '2026-11-25', end: '2026-12-24' });
    expect(periodOf('2027-01-10', 25)).toEqual({ key: '2027-01', start: '2026-12-25', end: '2027-01-24' });
    expect(periodOf('2026-12-25', 25)).toEqual({ key: '2027-01', start: '2026-12-25', end: '2027-01-24' });
    expect(periodOf('2026-12-31', 25).key).toBe('2027-01');
  });

  it('AC-PR-03 S=28 Februari non-kabisat & kabisat', () => {
    expect(periodByKey('2027-03', 28)).toEqual({ key: '2027-03', start: '2027-02-28', end: '2027-03-27' });
    expect(periodByKey('2027-02', 28)).toEqual({ key: '2027-02', start: '2027-01-28', end: '2027-02-27' });
    expect(periodOf('2028-02-29', 28).key).toBe('2028-03');
  });

  it('periode berurutan tanpa celah/tumpang tindih untuk semua S', () => {
    for (let s = 1; s <= 28; s++) {
      let key = '2026-01';
      for (let i = 0; i < 30; i++) {
        const p = periodByKey(key, s);
        const next = periodByKey(shiftPeriod(key, 1), s);
        expect(periodOf(p.start, s).key).toBe(key);
        expect(periodOf(p.end, s).key).toBe(key);
        expect(next.start).toBe(addDays(p.end, 1));
        key = next.key;
      }
    }
  });

  it('startDay di luar 1–28 di-clamp', () => {
    expect(periodOf('2026-11-30', 31)).toEqual(periodOf('2026-11-30', 28));
    expect(periodOf('2026-11-30', 0)).toEqual(periodOf('2026-11-30', 1));
  });

  it('shiftPeriod & lastPeriods', () => {
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(lastPeriods('2027-02', 3)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('label & rentang', () => {
    expect(formatPeriodLabel('2026-11')).toBe('November 2026');
    expect(formatPeriodRange(periodByKey('2026-11', 25))).toBe('25 Okt – 24 Nov');
    expect(formatPeriodRange(periodByKey('2027-01', 25))).toBe('25 Des 2026 – 24 Jan 2027');
  });

  it('hari tersisa inklusif', () => {
    const p = periodByKey('2026-11', 1);
    expect(daysRemaining('2026-11-20', p)).toBe(11);
    expect(daysRemaining('2026-11-30', p)).toBe(1);
    expect(daysRemaining('2026-12-01', p)).toBe(0);
  });
});
