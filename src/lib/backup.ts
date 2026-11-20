import {
  DEVICE_ONLY_SETTING_KEYS,
  SETTING_KEYS,
  type Account,
  type Budget,
  type Category,
  type ID,
  type LocalDate,
  type RecurringRule,
  type SettingKey,
  type SettingRow,
  type Template,
  type Transaction,
} from '../db/schema';
import { toLocalIsoString } from './dates';
import {
  accountIssues,
  budgetIssues,
  categoryIssues,
  isRecord,
  recurringIssues,
  templateIssues,
  transactionIssues,
} from './validation';

export const BACKUP_APP = 'arus';
export const BACKUP_FORMAT = 1;
export const BACKUP_SCHEMA_VERSION = 1;

export const BACKUP_TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'templates', 'settings'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: RecurringRule[];
  templates: Template[];
  settings: SettingRow[];
}

export type BackupCounts = Record<BackupTable, number>;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  schemaVersion: number;
  exportedAt: string;
  counts: BackupCounts;
  data: BackupData;
}

export function countsOf(data: BackupData): BackupCounts {
  return {
    accounts: data.accounts.length,
    categories: data.categories.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    recurring: data.recurring.length,
    templates: data.templates.length,
    settings: data.settings.length,
  };
}

const DEVICE_ONLY = new Set<SettingKey>(DEVICE_ONLY_SETTING_KEYS);
const KNOWN_KEYS = new Set<string>(SETTING_KEYS);

/** Bangun objek backup; setting khusus perangkat (PIN dll.) dibuang. */
export function buildBackup(data: BackupData, now: Date = new Date()): BackupFile {
  const clean: BackupData = { ...data, settings: data.settings.filter((s) => !DEVICE_ONLY.has(s.key)) };
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: toLocalIsoString(now),
    counts: countsOf(clean),
    data: clean,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** `arus-backup-YYYY-MM-DD.json` */
export function backupFileName(today: LocalDate): string {
  return `arus-backup-${today}.json`;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; reason: 'json' | 'not-arus' | 'format' | 'too-new' | 'invalid'; message: string; errors: string[] };

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
/** Migrasi JSON: key = schemaVersion asal → hasil versi+1. */
const MIGRATIONS: Record<number, Migration> = {};

const TABLE_LABEL: Record<BackupTable, string> = {
  accounts: 'akun',
  categories: 'kategori',
  transactions: 'transaksi',
  budgets: 'anggaran',
  recurring: 'aturan berulang',
  templates: 'favorit',
  settings: 'pengaturan',
};

class IssueCollector {
  private readonly counts = new Map<string, number>();

  add(table: BackupTable, problem: string) {
    const key = `${TABLE_LABEL[table]}\u0000${problem}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  get messages(): string[] {
    return [...this.counts.entries()].map(([key, n]) => {
      const [label, problem] = key.split('\u0000');
      return `${n} ${label} ${problem}`;
    });
  }
}

function fail(reason: Exclude<ParseBackupResult, { ok: true }>['reason'], message: string, errors: string[] = []): ParseBackupResult {
  return { ok: false, reason, message, errors };
}

/** Parse + validasi penuh file backup tanpa menulis apa pun (PRD §5.8). */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('json', 'File backup rusak atau bukan JSON.');
  }
  return validateBackup(raw);
}

export function validateBackup(raw: unknown): ParseBackupResult {
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return fail('not-arus', 'File ini bukan backup Arus.');
  if (raw.format !== BACKUP_FORMAT) return fail('format', 'Format backup tidak didukung.');
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail('format', 'Versi skema backup tidak valid.');
  }
  if (version > BACKUP_SCHEMA_VERSION) return fail('too-new', 'Backup dibuat oleh versi Arus yang lebih baru. Perbarui app dulu.');
  if (!isRecord(raw.data)) return fail('invalid', 'File backup tidak valid: data tidak ditemukan.');

  let data: Record<string, unknown> = raw.data;
  for (let v = version; v < BACKUP_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return fail('format', 'Versi skema backup tidak didukung.');
    data = migrate(data);
  }

  const issues = new IssueCollector();
  const tables = {} as Record<BackupTable, unknown[]>;
  for (const t of BACKUP_TABLES) {
    const value = data[t];
    if (value === undefined && t !== 'accounts' && t !== 'categories') {
      tables[t] = [];
    } else if (!Array.isArray(value)) {
      return fail('invalid', `File backup tidak valid: tabel ${TABLE_LABEL[t]} tidak ada.`);
    } else {
      tables[t] = value;
    }
  }

  const checkShape = (table: BackupTable, rows: unknown[], fn: (v: unknown) => string[]) => {
    const ids = new Set<string>();
    for (const row of rows) {
      const problems = fn(row);
      if (problems.length) issues.add(table, `tidak valid (${problems[0]})`);
      if (isRecord(row) && typeof row.id === 'string') {
        if (ids.has(row.id)) issues.add(table, 'memiliki id ganda');
        ids.add(row.id);
      }
    }
    return ids;
  };

  const accountIds = checkShape('accounts', tables.accounts, accountIssues);
  checkShape('categories', tables.categories, categoryIssues);
  checkShape('transactions', tables.transactions, transactionIssues);
  checkShape('budgets', tables.budgets, budgetIssues);
  checkShape('recurring', tables.recurring, recurringIssues);
  checkShape('templates', tables.templates, templateIssues);

  const categoryKind = new Map<ID, string>();
  for (const c of tables.categories) if (isRecord(c) && typeof c.id === 'string') categoryKind.set(c.id, String(c.kind));
  const hasAccount = (id: unknown) => typeof id === 'string' && accountIds.has(id);

  const checkRefs = (table: BackupTable, row: UnknownRow) => {
    if (row.accountId !== undefined && !hasAccount(row.accountId)) issues.add(table, 'merujuk akun yang tidak ada');
    if (row.toAccountId !== undefined && !hasAccount(row.toAccountId)) issues.add(table, 'merujuk akun tujuan yang tidak ada');
    if (row.categoryId !== undefined) {
      const kind = typeof row.categoryId === 'string' ? categoryKind.get(row.categoryId) : undefined;
      if (!kind) issues.add(table, 'merujuk kategori yang tidak ada');
      else if (table === 'budgets' ? kind !== 'expense' : (row.type === 'expense' || row.type === 'income') && kind !== row.type) {
        issues.add(table, 'memakai kategori dengan jenis yang salah');
      }
    }
  };

  for (const row of tables.transactions) if (isRecord(row)) checkRefs('transactions', row);
  for (const row of tables.budgets) if (isRecord(row)) checkRefs('budgets', row);
  for (const row of tables.recurring) if (isRecord(row)) checkRefs('recurring', row);
  for (const row of tables.templates) if (isRecord(row)) checkRefs('templates', row);

  const settingKeys = new Set<string>();
  for (const row of tables.settings) {
    if (!isRecord(row) || typeof row.key !== 'string' || !('value' in row)) issues.add('settings', 'tidak valid');
    else if (settingKeys.has(row.key)) issues.add('settings', 'memiliki key ganda');
    else settingKeys.add(row.key);
  }

  const activeAccounts = tables.accounts.filter((a) => isRecord(a) && a.archived === 0).length;
  const activeKinds = new Set(tables.categories.filter((c) => isRecord(c) && c.archived === 0).map((c) => (c as UnknownRow).kind));
  const errors = issues.messages;
  if (activeAccounts === 0) errors.push('tidak ada akun aktif');
  if (!activeKinds.has('expense') || !activeKinds.has('income')) errors.push('kategori aktif pengeluaran/pemasukan tidak lengkap');

  if (errors.length) return fail('invalid', `File backup tidak valid: ${errors.join('; ')}.`, errors);

  const settings = (tables.settings as SettingRow[]).filter((s) => KNOWN_KEYS.has(s.key) && !DEVICE_ONLY.has(s.key));
  const clean: BackupData = {
    accounts: tables.accounts as Account[],
    categories: tables.categories as Category[],
    transactions: tables.transactions as Transaction[],
    budgets: tables.budgets as Budget[],
    recurring: tables.recurring as RecurringRule[],
    templates: tables.templates as Template[],
    settings,
  };
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      counts: countsOf(clean),
      data: clean,
    },
  };
}

type UnknownRow = Record<string, unknown>;
