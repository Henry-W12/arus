import { newId } from '../lib/id';
import { db, type ArusDB } from './db';
import type { Account, AccountType, Category, CategoryKind, ColorToken, IconName } from './schema';

type SeedCategory = [name: string, icon: IconName, color: ColorToken];
type SeedAccount = [name: string, type: AccountType, icon: IconName, color: ColorToken];

/** Default DESIGN.md §2.2 & §5. Urutan = sortOrder. */
export const SEED_EXPENSE_CATEGORIES: readonly SeedCategory[] = [
  ['Makan & Minum', 'utensils', 'c1'],
  ['Transportasi', 'car', 'c2'],
  ['Belanja Harian', 'basket', 'c3'],
  ['Tagihan & Utilitas', 'bolt', 'c4'],
  ['Tempat Tinggal', 'home', 'c5'],
  ['Belanja', 'bag', 'c6'],
  ['Hiburan & Langganan', 'film', 'c7'],
  ['Kesehatan', 'heart-pulse', 'c8'],
  ['Keluarga & Sosial', 'users', 'c9'],
  ['Sedekah & Zakat', 'hand-heart', 'c10'],
  ['Pendidikan', 'book', 'c11'],
  ['Lainnya', 'dots', 'c12'],
];

export const SEED_INCOME_CATEGORIES: readonly SeedCategory[] = [
  ['Gaji', 'briefcase', 'c10'],
  ['Bonus & THR', 'gift', 'c4'],
  ['Usaha & Freelance', 'coins', 'c11'],
  ['Investasi & Bunga', 'trending-up', 'c3'],
  ['Hadiah', 'sparkle', 'c6'],
  ['Lainnya', 'dots', 'c12'],
];

export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  ['Tunai', 'cash', 'cash', 'c3'],
  ['Rekening Bank', 'bank', 'bank', 'c2'],
  ['E-Wallet', 'ewallet', 'smartphone-wallet', 'c8'],
];

function buildCategories(kind: CategoryKind, rows: readonly SeedCategory[], now: number): Category[] {
  return rows.map(([name, icon, color], i) => ({
    id: newId(),
    kind,
    name,
    icon,
    color,
    sortOrder: i,
    archived: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Tulis data default. Harus dipanggil di dalam transaksi rw atas semua tabel (tidak mengecek `seededAt`). */
export async function writeSeed(database: ArusDB = db, now: number = Date.now()): Promise<void> {
  const accounts: Account[] = SEED_ACCOUNTS.map(([name, type, icon, color], i) => ({
    id: newId(),
    name,
    type,
    icon,
    color,
    openingBalance: 0,
    includeInTotal: 1,
    sortOrder: i,
    archived: 0,
    createdAt: now,
    updatedAt: now,
  }));
  await database.accounts.bulkAdd(accounts);
  await database.categories.bulkAdd([
    ...buildCategories('expense', SEED_EXPENSE_CATEGORIES, now),
    ...buildCategories('income', SEED_INCOME_CATEGORIES, now),
  ]);
  await database.settings.bulkPut([
    { key: 'lastAccountId', value: accounts[0].id },
    { key: 'seededAt', value: now },
  ]);
}

/** Seed sekali saat pertama dibuka (idempoten lewat `seededAt`). Mengembalikan true jika seed dijalankan. */
export async function ensureSeeded(database: ArusDB = db): Promise<boolean> {
  return database.transaction('rw', database.allTables, async () => {
    const marker = await database.settings.get('seededAt');
    if (marker && typeof marker.value === 'number') return false;
    if ((await database.accounts.count()) > 0) {
      await database.settings.put({ key: 'seededAt', value: Date.now() });
      return false;
    }
    await writeSeed(database);
    return true;
  });
}
