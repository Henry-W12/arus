import { RECURRING_MAX_PER_RUN, type Flag, type Frequency, type LocalDate, type RecurringRule } from '../db/schema';
import { MONTHS_SHORT, WEEKDAYS_LONG, addDays, addMonthsClamped, localDateToDate, parseLocalDate } from './dates';

export interface Schedule {
  frequency: Frequency;
  interval: number;
  anchorDate: LocalDate;
}

/** Kejadian ke-k (0-based), selalu dihitung dari anchor (PRD §5.3). */
export function occurrence(schedule: Schedule, k: number): LocalDate {
  const { frequency, interval, anchorDate } = schedule;
  switch (frequency) {
    case 'daily':
      return addDays(anchorDate, k * interval);
    case 'weekly':
      return addDays(anchorDate, 7 * k * interval);
    case 'monthly':
      return addMonthsClamped(anchorDate, k * interval);
    case 'yearly':
      return addMonthsClamped(anchorDate, 12 * k * interval);
  }
}

export interface RecurringPlan {
  /** Tanggal kejadian yang harus dibuat sekarang, urut naik. */
  dates: LocalDate[];
  generatedCount: number;
  nextDate: LocalDate;
  active: Flag;
  /** true jika berhenti karena batas per run (masih ada sisa untuk run berikutnya). */
  capped: boolean;
}

type PlanInput = Pick<RecurringRule, 'frequency' | 'interval' | 'anchorDate' | 'endDate' | 'generatedCount'>;

/** Rencana generate untuk satu aturan aktif hingga `today` (inklusif). Fungsi murni. */
export function planRecurring(rule: PlanInput, today: LocalDate, maxPerRun = RECURRING_MAX_PER_RUN): RecurringPlan {
  const dates: LocalDate[] = [];
  let count = rule.generatedCount;
  let capped = false;
  for (;;) {
    const d = occurrence(rule, count);
    if (d > today || (rule.endDate !== undefined && d > rule.endDate)) break;
    if (dates.length >= maxPerRun) {
      capped = true;
      break;
    }
    dates.push(d);
    count += 1;
  }
  const nextDate = occurrence(rule, count);
  const finished = rule.endDate !== undefined && nextDate > rule.endDate;
  return { dates, generatedCount: count, nextDate, active: finished ? 0 : 1, capped };
}

/** Jumlah kejadian yang terlewat sampai `today` (untuk "Catat yang terlewat (N)"). Tanpa batas per run. */
export function countDue(rule: PlanInput, today: LocalDate): number {
  return planRecurring(rule, today, Number.MAX_SAFE_INTEGER).dates.length;
}

/** `generatedCount` setelah melewati semua kejadian ≤ today tanpa membuat transaksi ("Lewati"). */
export function skipDue(rule: PlanInput, today: LocalDate): { generatedCount: number; nextDate: LocalDate } {
  const plan = planRecurring(rule, today, Number.MAX_SAFE_INTEGER);
  return { generatedCount: plan.generatedCount, nextDate: plan.nextDate };
}

const FREQ_UNIT: Record<Frequency, string> = { daily: 'hari', weekly: 'minggu', monthly: 'bulan', yearly: 'tahun' };

/** "tiap bulan tgl 1", "tiap 2 minggu (Senin)", "tiap hari", "tiap tahun 29 Feb". */
export function describeSchedule(schedule: Schedule): string {
  const { frequency, interval, anchorDate } = schedule;
  const head = interval === 1 ? `tiap ${FREQ_UNIT[frequency]}` : `tiap ${interval} ${FREQ_UNIT[frequency]}`;
  const { m, d } = parseLocalDate(anchorDate);
  switch (frequency) {
    case 'daily':
      return head;
    case 'weekly':
      return `${head} (${WEEKDAYS_LONG[localDateToDate(anchorDate).getDay()]})`;
    case 'monthly':
      return `${head} tgl ${d}`;
    case 'yearly':
      return `${head} ${d} ${MONTHS_SHORT[m - 1]}`;
  }
}
