import { db } from '../db/db';
import type { Account, Budget, Category, Transaction } from '../db/schema';

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('acc'),
    name: `Akun ${seq}`,
    type: 'bank',
    icon: 'bank',
    color: 'c2',
    openingBalance: 0,
    includeInTotal: 1,
    sortOrder: seq,
    archived: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: nextId('cat'),
    kind: 'expense',
    name: `Kategori ${seq}`,
    icon: 'dots',
    color: 'c12',
    sortOrder: seq,
    archived: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

export function makeTx(overrides: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'accountId'>): Transaction {
  const createdAt = ++seq;
  return { id: nextId('tx'), date: '2026-11-20', createdAt, updatedAt: createdAt, ...overrides };
}

export function makeBudget(overrides: Partial<Budget> & Pick<Budget, 'categoryId' | 'amount' | 'startPeriod'>): Budget {
  return { id: nextId('bud'), createdAt: 1, updatedAt: 1, ...overrides };
}

export async function clearDb(): Promise<void> {
  await db.open();
  await db.transaction('rw', db.allTables, async () => {
    await Promise.all(db.allTables.map((t) => t.clear()));
  });
}
