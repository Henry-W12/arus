import type { ColorToken, IconName } from './iconIds';

export type { ColorToken, IconName } from './iconIds';

export type ID = string;
/** Tanggal bisnis lokal `YYYY-MM-DD`. */
export type LocalDate = string;
/** Kunci periode `YYYY-MM` (bulan dari tanggal akhir periode, PRD §5.6). */
export type PeriodKey = string;
export type Flag = 0 | 1;

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other';
export type CategoryKind = 'expense' | 'income';
export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment';
export type RecurringType = 'expense' | 'income' | 'transfer';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface Account extends Timestamps {
  id: ID;
  name: string;
  type: AccountType;
  icon: IconName;
  color: ColorToken;
  openingBalance: number;
  includeInTotal: Flag;
  sortOrder: number;
  archived: Flag;
}

export interface Category extends Timestamps {
  id: ID;
  kind: CategoryKind;
  name: string;
  icon: IconName;
  color: ColorToken;
  sortOrder: number;
  archived: Flag;
}

export interface Transaction extends Timestamps {
  id: ID;
  type: TransactionType;
  /** >0; khusus `adjustment` ≠0 dan boleh negatif. */
  amount: number;
  date: LocalDate;
  /** Akun sumber (transfer: dari). */
  accountId: ID;
  /** Hanya transfer, ≠ accountId. */
  toAccountId?: ID;
  /** Wajib untuk expense/income. */
  categoryId?: ID;
  note?: string;
  recurringId?: ID;
}

export interface Budget extends Timestamps {
  id: ID;
  categoryId: ID;
  /** 0 = anggaran dihapus mulai `startPeriod`. */
  amount: number;
  startPeriod: PeriodKey;
}

export interface RecurringRule extends Timestamps {
  id: ID;
  type: RecurringType;
  amount: number;
  accountId: ID;
  toAccountId?: ID;
  categoryId?: ID;
  note?: string;
  frequency: Frequency;
  /** 1–12. */
  interval: number;
  anchorDate: LocalDate;
  /** Inklusif. */
  endDate?: LocalDate;
  generatedCount: number;
  nextDate: LocalDate;
  active: Flag;
}

export interface Template extends Timestamps {
  id: ID;
  label: string;
  type: CategoryKind;
  amount: number;
  categoryId: ID;
  accountId?: ID;
  note?: string;
  sortOrder: number;
  useCount: number;
}

export interface PinRecord {
  hash: string;
  salt: string;
  iterations: number;
}

export interface PinLockState {
  failures: number;
  lockedUntil: number | null;
}

export type ThemeSetting = 'system' | 'light' | 'dark';
export type TextScale = 1 | 1.12 | 1.24;
export type BackupReminderDays = 0 | 7 | 14 | 30;
export type AutoLockMinutes = 0 | 1 | 5 | 15;

/** Peta key → tipe nilai tabel `settings` (PRD §2). */
export interface SettingsMap {
  periodStartDay: number;
  theme: ThemeSetting;
  textScale: TextScale;
  defaultAccount: 'last' | ID;
  lastAccountId: ID | null;
  openToAdd: boolean;
  backupReminderDays: BackupReminderDays;
  lastBackupAt: number | null;
  txCountAtLastBackup: number;
  /** "Nanti" pada banner backup: sembunyikan sampai epoch ms ini. */
  backupReminderSnoozedUntil: number | null;
  persistGranted: boolean | null;
  pin: PinRecord | null;
  pinLockState: PinLockState;
  autoLockMinutes: AutoLockMinutes;
  seededAt: number | null;
  installHintDismissedAt: number | null;
}

export type SettingKey = keyof SettingsMap;
export type Settings = SettingsMap;

export interface Setting<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingsMap[K];
}

/** Bentuk mentah di IndexedDB. */
export interface SettingRow {
  key: SettingKey;
  value: unknown;
}

export const DEFAULT_SETTINGS: Readonly<SettingsMap> = Object.freeze({
  periodStartDay: 1,
  theme: 'system',
  textScale: 1,
  defaultAccount: 'last',
  lastAccountId: null,
  openToAdd: true,
  backupReminderDays: 7,
  lastBackupAt: null,
  txCountAtLastBackup: 0,
  backupReminderSnoozedUntil: null,
  persistGranted: null,
  pin: null,
  pinLockState: { failures: 0, lockedUntil: null },
  autoLockMinutes: 1,
  seededAt: null,
  installHintDismissedAt: null,
});

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

/** Key yang khusus perangkat: tidak diekspor ke backup dan dipertahankan saat restore. */
export const DEVICE_ONLY_SETTING_KEYS: readonly SettingKey[] = [
  'pin',
  'pinLockState',
  'persistGranted',
  'lastBackupAt',
  'installHintDismissedAt',
  'backupReminderSnoozedUntil',
];

export const MAX_AMOUNT = 999_999_999_999;
export const MAX_TEMPLATES = 12;
export const ACCOUNT_NAME_MAX = 30;
export const CATEGORY_NAME_MAX = 24;
export const NOTE_MAX = 120;
export const TEMPLATE_LABEL_MAX = 24;
export const RECURRING_MAX_PER_RUN = 400;

export type NewAccount = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'archived'> &
  Partial<Pick<Account, 'sortOrder' | 'archived'>>;
export type NewCategory = Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'archived'> &
  Partial<Pick<Category, 'sortOrder' | 'archived'>>;
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
export type NewRecurringRule = Omit<
  RecurringRule,
  'id' | 'createdAt' | 'updatedAt' | 'generatedCount' | 'nextDate' | 'active'
> &
  Partial<Pick<RecurringRule, 'active'>>;
export type NewTemplate = Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'useCount'>;
