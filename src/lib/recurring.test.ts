import { describe, expect, it } from 'vitest';
import { countDue, describeSchedule, occurrence, planRecurring, skipDue, type Schedule } from './recurring';

const monthly31: Schedule = { frequency: 'monthly', interval: 1, anchorDate: '2027-01-31' };

describe('occurrence', () => {
  it('AC-RC-01 bulanan tgl 31 tidak bergeser permanen ke 28', () => {
    expect([0, 1, 2, 3, 4, 12, 13].map((k) => occurrence(monthly31, k))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
      '2028-01-31',
      '2028-02-29',
    ]);
  });

  it('AC-RC-06 mingguan interval 2', () => {
    const s: Schedule = { frequency: 'weekly', interval: 2, anchorDate: '2026-11-02' };
    expect([0, 1, 2].map((k) => occurrence(s, k))).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);
  });

  it('tahunan 29 Feb → 28 Feb di tahun non-kabisat, kembali 29 di kabisat', () => {
    const s: Schedule = { frequency: 'yearly', interval: 1, anchorDate: '2028-02-29' };
    expect([0, 1, 4].map((k) => occurrence(s, k))).toEqual(['2028-02-29', '2029-02-28', '2032-02-29']);
  });

  it('harian & bulanan interval 3 lintas tahun', () => {
    expect(occurrence({ frequency: 'daily', interval: 1, anchorDate: '2026-12-31' }, 1)).toBe('2027-01-01');
    expect(occurrence({ frequency: 'monthly', interval: 3, anchorDate: '2026-11-30' }, 1)).toBe('2027-02-28');
  });
});

describe('planRecurring', () => {
  it('AC-RC-02 catch-up 1 Nov & 1 Des saat dibuka 3 Des', () => {
    const plan = planRecurring({ frequency: 'monthly', interval: 1, anchorDate: '2026-11-01', generatedCount: 0 }, '2026-12-03');
    expect(plan.dates).toEqual(['2026-11-01', '2026-12-01']);
    expect(plan).toMatchObject({ generatedCount: 2, nextDate: '2027-01-01', active: 1, capped: false });
  });

  it('AC-RC-03 idempoten: rencana dari generatedCount baru kosong', () => {
    const first = planRecurring({ ...monthly31, generatedCount: 0 }, '2027-04-30');
    const second = planRecurring({ ...monthly31, generatedCount: first.generatedCount }, '2027-04-30');
    expect(first.dates).toHaveLength(4);
    expect(second.dates).toEqual([]);
  });

  it('kejadian hanya sampai hari ini (tanpa pre-generate)', () => {
    expect(planRecurring({ ...monthly31, generatedCount: 0 }, '2027-01-30').dates).toEqual([]);
    expect(planRecurring({ ...monthly31, generatedCount: 0 }, '2027-01-31').dates).toEqual(['2027-01-31']);
  });

  it('AC-RC-05 endDate inklusif → nonaktif setelahnya', () => {
    const plan = planRecurring(
      { frequency: 'weekly', interval: 1, anchorDate: '2026-11-02', endDate: '2026-11-16', generatedCount: 0 },
      '2026-12-31',
    );
    expect(plan.dates).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(plan.active).toBe(0);
  });

  it('AC-RC-08 maks 400 per run, sisanya run berikutnya', () => {
    const rule = { frequency: 'daily' as const, interval: 1, anchorDate: '2024-11-20', generatedCount: 0 };
    const first = planRecurring(rule, '2026-11-20');
    expect(first.dates).toHaveLength(400);
    expect(first.capped).toBe(true);
    const second = planRecurring({ ...rule, generatedCount: first.generatedCount }, '2026-11-20');
    expect(second.dates).toHaveLength(731 - 400);
    expect(second.dates[0]).toBe(occurrence(rule, 400));
    expect(second.capped).toBe(false);
  });

  it('countDue & skipDue untuk aktifkan kembali', () => {
    const rule = { frequency: 'monthly' as const, interval: 1, anchorDate: '2026-01-15', generatedCount: 3 };
    expect(countDue(rule, '2026-11-20')).toBe(8);
    expect(skipDue(rule, '2026-11-20')).toEqual({ generatedCount: 11, nextDate: '2026-12-15' });
  });

  it('describeSchedule', () => {
    expect(describeSchedule({ frequency: 'monthly', interval: 1, anchorDate: '2026-12-01' })).toBe('tiap bulan tgl 1');
    expect(describeSchedule({ frequency: 'weekly', interval: 2, anchorDate: '2026-11-02' })).toBe('tiap 2 minggu (Senin)');
  });
});
