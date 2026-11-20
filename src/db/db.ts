import Dexie, { type EntityTable } from 'dexie';
import type { Account, Budget, Category, RecurringRule, SettingRow, Template, Transaction } from './schema';

export const DB_NAME = 'arus';
export const SCHEMA_VERSION = 1;

export class ArusDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  recurring!: EntityTable<RecurringRule, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      accounts: 'id, sortOrder, archived',
      categories: 'id, kind, [kind+sortOrder], archived',
      transactions:
        'id, date, type, accountId, toAccountId, categoryId, recurringId, [accountId+date], [categoryId+date], createdAt',
      budgets: 'id, categoryId, [categoryId+startPeriod]',
      recurring: 'id, active, nextDate',
      templates: 'id, sortOrder, useCount',
      settings: 'key',
    });
  }

  get allTables() {
    return [
      this.accounts,
      this.categories,
      this.transactions,
      this.budgets,
      this.recurring,
      this.templates,
      this.settings,
    ];
  }
}

export const db = new ArusDB();

type VersionChangeListener = () => void;
const versionChangeListeners = new Set<VersionChangeListener>();

/**
 * Daftarkan callback saat DB ditutup karena versi baru dibuka di tab/jendela lain.
 * UI sebaiknya menampilkan "Muat ulang". Mengembalikan fungsi untuk berhenti mendengar.
 */
export function onDatabaseVersionChange(listener: VersionChangeListener): () => void {
  versionChangeListeners.add(listener);
  return () => versionChangeListeners.delete(listener);
}

db.on('versionchange', () => {
  db.close();
  versionChangeListeners.forEach((l) => l());
  return false;
});

db.on('blocked', () => {
  versionChangeListeners.forEach((l) => l());
});
