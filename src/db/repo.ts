import { computeBalances } from '../lib/balances';
import { todayLocal } from '../lib/dates';
import { RepoError } from '../lib/errors';
import { newId } from '../lib/id';
import { isValidAdjustmentAmount, isValidAmount } from '../lib/money';
import { clampStartDay, isValidPeriodKey } from '../lib/period';
import { countDue, occurrence, planRecurring, skipDue } from '../lib/recurring';
import {
  accountIssues,
  categoryIssues,
  normalizeNote,
  recurringIssues,
  sameName,
  templateIssues,
  transactionIssues,
} from '../lib/validation';
import { db } from './db';
import {
  DEFAULT_SETTINGS,
  MAX_TEMPLATES,
  type Account,
  type Budget,
  type Category,
  type CategoryKind,
  type ID,
  type LocalDate,
  type NewAccount,
  type NewCategory,
  type NewRecurringRule,
  type NewTemplate,
  type NewTransaction,
  type PeriodKey,
  type RecurringRule,
  type SettingKey,
  type SettingRow,
  type Settings,
  type SettingsMap,
  type Template,
  type Transaction,
} from './schema';
import { writeSeed } from './seed';

/* ------------------------------------------------------------------ util */

function compact<T extends object>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out) as (keyof T)[]) if (out[key] === undefined) delete out[key];
  return out;
}

function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}

function invalid(issues: string[]): never {
  const first = issues[0] ?? 'data tidak valid';
  throw new RepoError('invalid', first.charAt(0).toUpperCase() + first.slice(1));
}

async function mustGet<T>(promise: Promise<T | undefined>, label: string): Promise<T> {
  const value = await promise;
  if (value === undefined) throw new RepoError('not-found', `${label} tidak ditemukan`);
  return value;
}

/* -------------------------------------------------------------- settings */

/** Gabungkan baris `settings` dengan default. */
export function mergeSettings(rows: readonly SettingRow[]): Settings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  return merged as unknown as Settings;
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await db.settings.toArray());
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  const row = await db.settings.get(key);
  return row === undefined ? DEFAULT_SETTINGS[key] : (row.value as SettingsMap[K]);
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingsMap[K]): Promise<void> {
  const v = key === 'periodStartDay' ? clampStartDay(value as number) : value;
  await db.settings.put({ key, value: v });
}

export async function setSettings(values: Partial<SettingsMap>): Promise<void> {
  const rows = (Object.keys(values) as SettingKey[]).map((key) => ({
    key,
    value: key === 'periodStartDay' ? clampStartDay(values[key] as number) : values[key],
  }));
  await db.settings.bulkPut(rows);
}

/** Akun default untuk input baru: setting `defaultAccount` → `lastAccountId` → akun aktif pertama. */
export function resolveDefaultAccountId(settings: Settings, accounts: readonly Account[]): ID | null {
  const active = accounts.filter((a) => a.archived === 0).sort((a, b) => a.sortOrder - b.sortOrder);
  const isActive = (id: ID | null) => id !== null && active.some((a) => a.id === id);
  if (settings.defaultAccount !== 'last' && isActive(settings.defaultAccount)) return settings.defaultAccount;
  if (isActive(settings.lastAccountId)) return settings.lastAccountId;
  return active[0]?.id ?? null;
}

/* ---------------------------------------------------------- transactions */

export type TransactionInput = NewTransaction;

async function checkTransactionRefs(tx: Transaction, requireActive: boolean): Promise<void> {
  const ids = [tx.accountId, ...(tx.toAccountId ? [tx.toAccountId] : [])];
  const accounts = await db.accounts.bulkGet(ids);
  accounts.forEach((a) => {
    if (!a) throw new RepoError('invalid', 'Akun tidak ditemukan');
    if (requireActive && a.archived === 1) throw new RepoError('invalid', `Akun ${a.name} sudah diarsipkan`);
  });
  if (tx.categoryId) {
    const cat = await db.categories.get(tx.categoryId);
    if (!cat) throw new RepoError('invalid', 'Kategori tidak ditemukan');
    if (cat.kind !== tx.type) throw new RepoError('invalid', 'Jenis kategori tidak sesuai');
    if (requireActive && cat.archived === 1) throw new RepoError('invalid', `Kategori ${cat.name} sudah diarsipkan`);
  }
}

function buildTransaction(input: NewTransaction, id: ID, createdAt: number, updatedAt: number): Transaction {
  const tx = compact<Transaction>({ ...input, id, note: normalizeNote(input.note), createdAt, updatedAt });
  if (tx.type !== 'transfer') delete tx.toAccountId;
  if (tx.type === 'transfer' || tx.type === 'adjustment') delete tx.categoryId;
  const issues = transactionIssues(tx);
  if (issues.length) invalid(issues);
  return tx;
}

/** Simpan transaksi baru + perbarui `lastAccountId`. */
export async function addTransaction(input: TransactionInput): Promise<Transaction> {
  const now = Date.now();
  const tx = buildTransaction(input, newId(), now, now);
  return db.transaction('rw', [db.transactions, db.accounts, db.categories, db.settings], async () => {
    await checkTransactionRefs(tx, true);
    await db.transactions.add(tx);
    if (tx.type !== 'adjustment') await db.settings.put({ key: 'lastAccountId', value: tx.accountId });
    return tx;
  });
}

/** Ubah transaksi. Field yang diset `undefined` di patch akan dihapus. `createdAt` tetap. */
export async function updateTransaction(id: ID, patch: Partial<NewTransaction>): Promise<Transaction> {
  return db.transaction('rw', [db.transactions, db.accounts, db.categories], async () => {
    const old = await mustGet(db.transactions.get(id), 'Transaksi');
    const next = buildTransaction({ ...omit(old, 'id', 'createdAt', 'updatedAt'), ...patch }, id, old.createdAt, Math.max(Date.now(), old.updatedAt + 1));
    await checkTransactionRefs(next, false);
    await db.transactions.put(next);
    return next;
  });
}

/** Hapus transaksi; mengembalikan record lama untuk Urungkan. */
export async function deleteTransaction(id: ID): Promise<Transaction | undefined> {
  return db.transaction('rw', db.transactions, async () => {
    const old = await db.transactions.get(id);
    if (old) await db.transactions.delete(id);
    return old;
  });
}

/** Urungkan hapus/edit: tulis kembali record identik (id sama). */
export async function restoreTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put(tx);
}

export interface TransferInput {
  fromAccountId: ID;
  toAccountId: ID;
  amount: number;
  date: LocalDate;
  note?: string;
}

/** Transfer = satu record `type='transfer'` (PRD §5.2). */
export function addTransfer(input: TransferInput): Promise<Transaction> {
  return addTransaction({
    type: 'transfer',
    amount: input.amount,
    date: input.date,
    accountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    note: input.note,
  });
}

export const ADJUSTMENT_NOTE = 'Penyesuaian saldo';

/** Saldo akun per `asOf` (default hari ini). */
export async function getAccountBalance(accountId: ID, asOf: LocalDate = todayLocal()): Promise<number> {
  const account = await mustGet(db.accounts.get(accountId), 'Akun');
  const [fromTxs, toTxs] = await Promise.all([
    db.transactions.where('accountId').equals(accountId).toArray(),
    db.transactions.where('toAccountId').equals(accountId).toArray(),
  ]);
  const unique = new Map([...fromTxs, ...toTxs].map((t) => [t.id, t]));
  return computeBalances([account], [...unique.values()], asOf).get(accountId) ?? 0;
}

/**
 * "Sesuaikan saldo": catat adjustment sebesar selisih agar saldo hari ini = `actualBalance`.
 * Mengembalikan `null` jika selisih 0.
 */
export async function adjustBalance(accountId: ID, actualBalance: number, today: LocalDate = todayLocal()): Promise<Transaction | null> {
  if (!Number.isSafeInteger(actualBalance)) throw new RepoError('invalid', 'Saldo tidak valid');
  return db.transaction('rw', [db.transactions, db.accounts, db.categories, db.settings], async () => {
    const delta = actualBalance - (await getAccountBalance(accountId, today));
    if (delta === 0) return null;
    if (!isValidAdjustmentAmount(delta)) throw new RepoError('invalid', 'Selisih saldo terlalu besar');
    return addTransaction({ type: 'adjustment', amount: delta, date: today, accountId, note: ADJUSTMENT_NOTE });
  });
}

/* -------------------------------------------------------------- accounts */

async function assertUniqueAccountName(name: string, exceptId?: ID): Promise<void> {
  const active = await db.accounts.where('archived').equals(0).toArray();
  if (active.some((a) => a.id !== exceptId && sameName(a.name, name))) {
    throw new RepoError('duplicate-name', 'Nama sudah dipakai');
  }
}

async function nextSortOrder(table: 'accounts' | 'templates'): Promise<number> {
  const last = await db[table].orderBy('sortOrder').last();
  return last ? last.sortOrder + 1 : 0;
}

export async function createAccount(input: NewAccount): Promise<Account> {
  return db.transaction('rw', db.accounts, async () => {
    const now = Date.now();
    const account: Account = {
      ...input,
      id: newId(),
      name: input.name.trim(),
      includeInTotal: input.includeInTotal ?? 1,
      openingBalance: input.openingBalance ?? 0,
      sortOrder: input.sortOrder ?? (await nextSortOrder('accounts')),
      archived: input.archived ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    const issues = accountIssues(account);
    if (issues.length) invalid(issues);
    await assertUniqueAccountName(account.name);
    await db.accounts.add(account);
    return account;
  });
}

export type AccountPatch = Partial<Pick<Account, 'name' | 'type' | 'icon' | 'color' | 'openingBalance' | 'includeInTotal'>>;

export async function updateAccount(id: ID, patch: AccountPatch): Promise<Account> {
  return db.transaction('rw', db.accounts, async () => {
    const old = await mustGet(db.accounts.get(id), 'Akun');
    const next: Account = { ...old, ...compact(patch), updatedAt: Date.now() };
    next.name = next.name.trim();
    const issues = accountIssues(next);
    if (issues.length) invalid(issues);
    if (old.archived === 0) await assertUniqueAccountName(next.name, id);
    await db.accounts.put(next);
    return next;
  });
}

async function accountHasTransactions(id: ID): Promise<boolean> {
  const [a, b] = await Promise.all([
    db.transactions.where('accountId').equals(id).count(),
    db.transactions.where('toAccountId').equals(id).count(),
  ]);
  return a + b > 0;
}

export async function canDeleteAccount(id: ID): Promise<boolean> {
  return !(await accountHasTransactions(id));
}

/** Jumlah aturan berulang aktif yang memakai akun (untuk teks konfirmasi arsip). */
export async function countActiveRulesForAccount(id: ID): Promise<number> {
  const rules = await db.recurring.where('active').equals(1).toArray();
  return rules.filter((r) => r.accountId === id || r.toAccountId === id).length;
}

async function assertNotLastActiveAccount(id: ID): Promise<void> {
  const active = await db.accounts.where('archived').equals(0).toArray();
  if (active.length <= 1 && active.some((a) => a.id === id)) {
    throw new RepoError('last-active', 'Minimal harus ada 1 akun aktif');
  }
}

/** Arsipkan akun; aturan berulang yang memakainya dinonaktifkan dan setting akun default disesuaikan. */
export async function archiveAccount(id: ID): Promise<{ deactivatedRules: number }> {
  return db.transaction('rw', [db.accounts, db.recurring, db.settings], async () => {
    const account = await mustGet(db.accounts.get(id), 'Akun');
    if (account.archived === 1) return { deactivatedRules: 0 };
    await assertNotLastActiveAccount(id);
    const now = Date.now();
    await db.accounts.update(id, { archived: 1, updatedAt: now });
    const rules = (await db.recurring.where('active').equals(1).toArray()).filter(
      (r) => r.accountId === id || r.toAccountId === id,
    );
    for (const r of rules) await db.recurring.update(r.id, { active: 0, updatedAt: now });
    const settings = mergeSettings(await db.settings.toArray());
    if (settings.defaultAccount === id) await db.settings.put({ key: 'defaultAccount', value: 'last' });
    if (settings.lastAccountId === id) {
      const first = (await db.accounts.orderBy('sortOrder').toArray()).find((a) => a.archived === 0);
      await db.settings.put({ key: 'lastAccountId', value: first?.id ?? null });
    }
    return { deactivatedRules: rules.length };
  });
}

export async function unarchiveAccount(id: ID): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    const account = await mustGet(db.accounts.get(id), 'Akun');
    await assertUniqueAccountName(account.name, id);
    await db.accounts.update(id, { archived: 0, updatedAt: Date.now() });
  });
}

/** Hapus permanen; hanya untuk akun tanpa transaksi. */
export async function deleteAccount(id: ID): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.recurring, db.templates, db.settings], async () => {
    await mustGet(db.accounts.get(id), 'Akun');
    if (await accountHasTransactions(id)) {
      throw new RepoError('has-transactions', 'Akun yang punya transaksi hanya bisa diarsipkan');
    }
    await assertNotLastActiveAccount(id);
    const rules = (await db.recurring.toArray()).filter((r) => r.accountId === id || r.toAccountId === id);
    await db.recurring.bulkDelete(rules.map((r) => r.id));
    const templates = (await db.templates.toArray()).filter((t) => t.accountId === id);
    for (const t of templates) {
      await db.templates.put({ ...omit(t, 'accountId'), updatedAt: Date.now() });
    }
    await db.accounts.delete(id);
    const settings = mergeSettings(await db.settings.toArray());
    if (settings.defaultAccount === id) await db.settings.put({ key: 'defaultAccount', value: 'last' });
    if (settings.lastAccountId === id) {
      const first = (await db.accounts.orderBy('sortOrder').toArray()).find((a) => a.archived === 0);
      await db.settings.put({ key: 'lastAccountId', value: first?.id ?? null });
    }
  });
}

/** Simpan urutan manual (index = sortOrder). */
export async function reorderAccounts(ids: readonly ID[]): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    const now = Date.now();
    await Promise.all(ids.map((id, i) => db.accounts.update(id, { sortOrder: i, updatedAt: now })));
  });
}

/* ------------------------------------------------------------ categories */

async function assertUniqueCategoryName(kind: CategoryKind, name: string, exceptId?: ID): Promise<void> {
  const same = await db.categories.where('kind').equals(kind).toArray();
  if (same.some((c) => c.id !== exceptId && c.archived === 0 && sameName(c.name, name))) {
    throw new RepoError('duplicate-name', 'Nama sudah dipakai');
  }
}

export async function createCategory(input: NewCategory): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const now = Date.now();
    const sameKind = await db.categories.where('kind').equals(input.kind).toArray();
    const category: Category = {
      ...input,
      id: newId(),
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? sameKind.reduce((max, c) => Math.max(max, c.sortOrder + 1), 0),
      archived: input.archived ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    const issues = categoryIssues(category);
    if (issues.length) invalid(issues);
    await assertUniqueCategoryName(category.kind, category.name);
    await db.categories.add(category);
    return category;
  });
}

export type CategoryPatch = Partial<Pick<Category, 'name' | 'icon' | 'color'>>;

export async function updateCategory(id: ID, patch: CategoryPatch): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const old = await mustGet(db.categories.get(id), 'Kategori');
    const next: Category = { ...old, ...compact(patch), updatedAt: Date.now() };
    next.name = next.name.trim();
    const issues = categoryIssues(next);
    if (issues.length) invalid(issues);
    if (old.archived === 0) await assertUniqueCategoryName(next.kind, next.name, id);
    await db.categories.put(next);
    return next;
  });
}

async function assertNotLastActiveCategory(category: Category): Promise<void> {
  const active = (await db.categories.where('kind').equals(category.kind).toArray()).filter((c) => c.archived === 0);
  if (active.length <= 1 && active.some((c) => c.id === category.id)) {
    throw new RepoError('last-active', 'Minimal harus ada 1 kategori aktif');
  }
}

export async function canDeleteCategory(id: ID): Promise<boolean> {
  return (await db.transactions.where('categoryId').equals(id).count()) === 0;
}

export async function archiveCategory(id: ID): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await mustGet(db.categories.get(id), 'Kategori');
    if (category.archived === 1) return;
    await assertNotLastActiveCategory(category);
    await db.categories.update(id, { archived: 1, updatedAt: Date.now() });
  });
}

export async function unarchiveCategory(id: ID): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const category = await mustGet(db.categories.get(id), 'Kategori');
    await assertUniqueCategoryName(category.kind, category.name, id);
    await db.categories.update(id, { archived: 0, updatedAt: Date.now() });
  });
}

/** Hapus permanen kategori tanpa transaksi (beserta anggaran, favorit, dan aturan yang memakainya). */
export async function deleteCategory(id: ID): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.budgets, db.templates, db.recurring], async () => {
    const category = await mustGet(db.categories.get(id), 'Kategori');
    if (!(await canDeleteCategory(id))) {
      throw new RepoError('has-transactions', 'Kategori yang punya transaksi hanya bisa diarsipkan');
    }
    await assertNotLastActiveCategory(category);
    await db.budgets.where('categoryId').equals(id).delete();
    await db.templates.filter((t) => t.categoryId === id).delete();
    await db.recurring.filter((r) => r.categoryId === id).delete();
    await db.categories.delete(id);
  });
}

export async function reorderCategories(ids: readonly ID[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const now = Date.now();
    await Promise.all(ids.map((id, i) => db.categories.update(id, { sortOrder: i, updatedAt: now })));
  });
}

/* --------------------------------------------------------------- budgets */

/**
 * Atur anggaran kategori mulai periode `startPeriod` (upsert `[categoryId+startPeriod]`).
 * `amount = 0` = hapus anggaran mulai periode itu.
 */
export async function setBudget(categoryId: ID, startPeriod: PeriodKey, amount: number): Promise<Budget> {
  if (!isValidPeriodKey(startPeriod)) throw new RepoError('invalid', 'Periode tidak valid');
  if (amount !== 0 && !isValidAmount(amount)) throw new RepoError('invalid', 'Nominal tidak valid');
  return db.transaction('rw', [db.budgets, db.categories], async () => {
    const category = await mustGet(db.categories.get(categoryId), 'Kategori');
    if (category.kind !== 'expense') throw new RepoError('invalid', 'Anggaran hanya untuk kategori pengeluaran');
    const now = Date.now();
    const existing = await db.budgets.where('[categoryId+startPeriod]').equals([categoryId, startPeriod]).first();
    const budget: Budget = existing
      ? { ...existing, amount, updatedAt: now }
      : { id: newId(), categoryId, startPeriod, amount, createdAt: now, updatedAt: now };
    await db.budgets.put(budget);
    return budget;
  });
}

export function removeBudget(categoryId: ID, startPeriod: PeriodKey): Promise<Budget> {
  return setBudget(categoryId, startPeriod, 0);
}

/* ------------------------------------------------------------- recurring */

export interface RunRecurringResult {
  /** Jumlah transaksi yang dibuat. */
  created: number;
  transactionIds: ID[];
  /** `createdAt` minimum batch ini (untuk filter `createdSince` di banner). */
  since: number;
}

/**
 * Generator transaksi berulang (PRD §5.3): idempoten via `generatedCount`, catch-up sampai `today`,
 * maks. 400 kejadian per aturan per run. `ruleIds` membatasi ke aturan tertentu.
 */
export async function runRecurring(today: LocalDate = todayLocal(), ruleIds?: readonly ID[]): Promise<RunRecurringResult> {
  const since = Date.now();
  return db.transaction('rw', [db.recurring, db.transactions, db.accounts, db.categories], async () => {
    let rules = await db.recurring.where('active').equals(1).toArray();
    if (ruleIds) rules = rules.filter((r) => ruleIds.includes(r.id));
    const transactionIds: ID[] = [];
    let stamp = since;

    for (const rule of rules) {
      const plan = planRecurring(rule, today);
      if (plan.dates.length > 0 && !(await ruleRefsUsable(rule))) {
        await db.recurring.update(rule.id, { active: 0, updatedAt: Date.now() });
        continue;
      }
      const txs: Transaction[] = plan.dates.map((date) => {
        const createdAt = stamp++;
        return compact<Transaction>({
          id: newId(),
          type: rule.type,
          amount: rule.amount,
          date,
          accountId: rule.accountId,
          toAccountId: rule.type === 'transfer' ? rule.toAccountId : undefined,
          categoryId: rule.type === 'transfer' ? undefined : rule.categoryId,
          note: rule.note,
          recurringId: rule.id,
          createdAt,
          updatedAt: createdAt,
        });
      });
      if (txs.length) await db.transactions.bulkAdd(txs);
      transactionIds.push(...txs.map((t) => t.id));
      if (plan.generatedCount !== rule.generatedCount || plan.nextDate !== rule.nextDate || plan.active !== rule.active) {
        await db.recurring.update(rule.id, {
          generatedCount: plan.generatedCount,
          nextDate: plan.nextDate,
          active: plan.active,
          updatedAt: Date.now(),
        });
      }
    }
    return { created: transactionIds.length, transactionIds, since };
  });
}

async function ruleRefsUsable(rule: RecurringRule): Promise<boolean> {
  const ids = [rule.accountId, ...(rule.type === 'transfer' && rule.toAccountId ? [rule.toAccountId] : [])];
  const accounts = await db.accounts.bulkGet(ids);
  if (accounts.some((a) => !a || a.archived === 1)) return false;
  if (rule.type === 'transfer') return Boolean(rule.toAccountId);
  const cat = rule.categoryId ? await db.categories.get(rule.categoryId) : undefined;
  return Boolean(cat && cat.archived === 0 && cat.kind === rule.type);
}

function buildRule(input: NewRecurringRule, base: Partial<RecurringRule> & Pick<RecurringRule, 'id' | 'createdAt'>): RecurringRule {
  const rule = compact<RecurringRule>({
    ...input,
    note: normalizeNote(input.note),
    toAccountId: input.type === 'transfer' ? input.toAccountId : undefined,
    categoryId: input.type === 'transfer' ? undefined : input.categoryId,
    generatedCount: base.generatedCount ?? 0,
    nextDate: base.nextDate ?? input.anchorDate,
    active: input.active ?? base.active ?? 1,
    id: base.id,
    createdAt: base.createdAt,
    updatedAt: Date.now(),
  });
  const issues = recurringIssues(rule);
  if (issues.length) invalid(issues);
  return rule;
}

/**
 * Buat aturan berulang lalu langsung generate kejadian ≤ today
 * (anchor = hari ini → tepat 1 transaksi hari ini, AC-RC-07).
 */
export async function createRecurring(
  input: NewRecurringRule,
  today: LocalDate = todayLocal(),
): Promise<{ rule: RecurringRule; run: RunRecurringResult }> {
  const rule = buildRule(input, { id: newId(), createdAt: Date.now() });
  await db.transaction('rw', [db.recurring, db.accounts, db.categories], async () => {
    if (!(await ruleRefsUsable(rule))) throw new RepoError('invalid', 'Akun atau kategori tidak tersedia');
    await db.recurring.add(rule);
  });
  const run = await runRecurring(today, [rule.id]);
  return { rule: await mustGet(db.recurring.get(rule.id), 'Aturan'), run };
}

/**
 * Ubah aturan. Jika `anchorDate`/`frequency`/`interval` berubah → `generatedCount=0` dan dihitung ulang
 * dari anchor baru (kejadian ≤ today langsung dibuat). Transaksi lama tidak diubah.
 */
export async function updateRecurring(
  id: ID,
  patch: Partial<NewRecurringRule>,
  today: LocalDate = todayLocal(),
): Promise<{ rule: RecurringRule; run: RunRecurringResult }> {
  const updated = await db.transaction('rw', [db.recurring, db.accounts, db.categories], async () => {
    const old = await mustGet(db.recurring.get(id), 'Aturan');
    const { createdAt, generatedCount, nextDate } = old;
    const merged: NewRecurringRule = { ...omit(old, 'id', 'createdAt', 'updatedAt', 'generatedCount', 'nextDate'), ...patch };
    const scheduleChanged =
      merged.anchorDate !== old.anchorDate || merged.frequency !== old.frequency || merged.interval !== old.interval;
    const count = scheduleChanged ? 0 : generatedCount;
    const rule = buildRule(merged, {
      id,
      createdAt,
      generatedCount: count,
      nextDate: scheduleChanged ? merged.anchorDate : nextDate,
      active: old.active,
    });
    if (rule.active === 1 && !(await ruleRefsUsable(rule))) throw new RepoError('invalid', 'Akun atau kategori tidak tersedia');
    if (rule.endDate !== undefined && occurrence(rule, rule.generatedCount) > rule.endDate) rule.active = 0;
    await db.recurring.put(rule);
    return rule;
  });
  const run = updated.active === 1 ? await runRecurring(today, [id]) : { created: 0, transactionIds: [], since: Date.now() };
  return { rule: await mustGet(db.recurring.get(id), 'Aturan'), run };
}

export async function pauseRecurring(id: ID): Promise<void> {
  await db.recurring.update(id, { active: 0, updatedAt: Date.now() });
}

/** Jumlah kejadian terlewat yang akan dicatat jika aturan diaktifkan kembali dengan "Catat yang terlewat". */
export async function countMissedOccurrences(id: ID, today: LocalDate = todayLocal()): Promise<number> {
  const rule = await mustGet(db.recurring.get(id), 'Aturan');
  return countDue(rule, today);
}

/**
 * Aktifkan kembali aturan. `catch-up` = buat semua kejadian terlewat; `skip` = majukan
 * `generatedCount` sampai kejadian berikutnya > today tanpa membuat transaksi.
 */
export async function resumeRecurring(
  id: ID,
  mode: 'catch-up' | 'skip',
  today: LocalDate = todayLocal(),
): Promise<RunRecurringResult> {
  await db.transaction('rw', [db.recurring, db.accounts, db.categories], async () => {
    const rule = await mustGet(db.recurring.get(id), 'Aturan');
    if (!(await ruleRefsUsable(rule))) throw new RepoError('invalid', 'Akun atau kategori aturan ini sudah diarsipkan');
    const changes: Partial<RecurringRule> = { active: 1, updatedAt: Date.now() };
    if (mode === 'skip') Object.assign(changes, skipDue(rule, today));
    const next = { ...rule, ...changes };
    if (next.endDate !== undefined && occurrence(next, next.generatedCount) > next.endDate) changes.active = 0;
    await db.recurring.update(id, changes);
  });
  return runRecurring(today, [id]);
}

/** Jumlah transaksi aturan ini yang bertanggal > today. */
export async function countFutureTransactionsOfRule(id: ID, today: LocalDate = todayLocal()): Promise<number> {
  return db.transactions.where('recurringId').equals(id).filter((t) => t.date > today).count();
}

/** Hapus aturan. Transaksi yang sudah dibuat tetap ada, kecuali `deleteFuture` (tanggal > today). */
export async function deleteRecurring(
  id: ID,
  options: { deleteFuture?: boolean; today?: LocalDate } = {},
): Promise<void> {
  const today = options.today ?? todayLocal();
  await db.transaction('rw', [db.recurring, db.transactions], async () => {
    await db.recurring.delete(id);
    if (options.deleteFuture) {
      await db.transactions.where('recurringId').equals(id).filter((t) => t.date > today).delete();
    }
  });
}

/* ------------------------------------------------------------- templates */

function buildTemplate(input: NewTemplate, base: Pick<Template, 'id' | 'createdAt' | 'sortOrder' | 'useCount'>): Template {
  const template = compact<Template>({
    ...input,
    label: input.label.trim(),
    note: normalizeNote(input.note),
    ...base,
    updatedAt: Date.now(),
  });
  const issues = templateIssues(template);
  if (issues.length) invalid(issues);
  return template;
}

async function checkTemplateRefs(t: Template): Promise<void> {
  const cat = await db.categories.get(t.categoryId);
  if (!cat || cat.kind !== t.type) throw new RepoError('invalid', 'Kategori tidak sesuai');
  if (t.accountId && !(await db.accounts.get(t.accountId))) throw new RepoError('invalid', 'Akun tidak ditemukan');
}

/** Maks. 12 favorit (AC-CT-05). */
export async function createTemplate(input: NewTemplate): Promise<Template> {
  return db.transaction('rw', [db.templates, db.categories, db.accounts], async () => {
    if ((await db.templates.count()) >= MAX_TEMPLATES) {
      throw new RepoError('limit-reached', `Maksimal ${MAX_TEMPLATES} favorit`);
    }
    const template = buildTemplate(input, {
      id: newId(),
      createdAt: Date.now(),
      sortOrder: await nextSortOrder('templates'),
      useCount: 0,
    });
    await checkTemplateRefs(template);
    await db.templates.add(template);
    return template;
  });
}

export async function updateTemplate(id: ID, patch: Partial<NewTemplate>): Promise<Template> {
  return db.transaction('rw', [db.templates, db.categories, db.accounts], async () => {
    const old = await mustGet(db.templates.get(id), 'Favorit');
    const { createdAt, sortOrder, useCount } = old;
    const rest = omit(old, 'id', 'createdAt', 'updatedAt', 'sortOrder', 'useCount');
    const template = buildTemplate({ ...rest, ...patch }, { id, createdAt, sortOrder, useCount });
    await checkTemplateRefs(template);
    await db.templates.put(template);
    return template;
  });
}

export async function deleteTemplate(id: ID): Promise<void> {
  await db.templates.delete(id);
}

export async function reorderTemplates(ids: readonly ID[]): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    const now = Date.now();
    await Promise.all(ids.map((id, i) => db.templates.update(id, { sortOrder: i, updatedAt: now })));
  });
}

/** Pakai favorit = simpan instan bertanggal `today`, `useCount++` (PRD §4.2). */
export async function applyTemplate(id: ID, today: LocalDate = todayLocal()): Promise<Transaction> {
  return db.transaction('rw', [db.templates, db.transactions, db.accounts, db.categories, db.settings], async () => {
    const template = await mustGet(db.templates.get(id), 'Favorit');
    const settings = mergeSettings(await db.settings.toArray());
    const accounts = await db.accounts.toArray();
    const own = template.accountId ? accounts.find((a) => a.id === template.accountId && a.archived === 0) : undefined;
    const accountId = own?.id ?? resolveDefaultAccountId(settings, accounts);
    if (!accountId) throw new RepoError('invalid', 'Tidak ada akun aktif');
    const tx = await addTransaction({
      type: template.type,
      amount: template.amount,
      date: today,
      accountId,
      categoryId: template.categoryId,
      note: template.note,
    });
    await db.templates.update(id, { useCount: template.useCount + 1 });
    return tx;
  });
}

/* ------------------------------------------------------------------ data */

export interface DataCounts {
  transactions: number;
  accounts: number;
  categories: number;
}

export async function getDataCounts(): Promise<DataCounts> {
  const [transactions, accounts, categories] = await Promise.all([
    db.transactions.count(),
    db.accounts.count(),
    db.categories.count(),
  ]);
  return { transactions, accounts, categories };
}

/** "Hapus semua data": kosongkan semua tabel (termasuk PIN) lalu seed ulang. */
export async function resetAllData(): Promise<void> {
  await db.transaction('rw', db.allTables, async () => {
    await Promise.all(db.allTables.map((t) => t.clear()));
    await writeSeed(db);
  });
}
