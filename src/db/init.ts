import { todayLocal } from '../lib/dates';
import { ensurePersistentStorage } from '../lib/storage';
import { db } from './db';
import { runRecurring, type RunRecurringResult } from './repo';
import { ensureSeeded } from './seed';

export interface InitResult {
  seeded: boolean;
  recurring: RunRecurringResult;
}

/**
 * Panggil sekali saat app mulai: buka DB, seed jika pertama kali, jalankan generator berulang,
 * dan minta storage permanen (tidak ditunggu). Lempar error jika DB gagal dibuka.
 */
export async function initDatabase(today: string = todayLocal()): Promise<InitResult> {
  await db.open();
  const seeded = await ensureSeeded(db);
  const recurring = await runRecurring(today);
  void ensurePersistentStorage();
  return { seeded, recurring };
}
