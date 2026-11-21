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
 * `runGenerator: false` = generator tidak ditunggu di sini; pemanggil menjalankan `runRecurring()`
 * setelah UI tampil (BUG-12: ratusan kejadian tertunda tidak boleh menahan layar pertama).
 */
export async function initDatabase(
  today: string = todayLocal(),
  options: { runGenerator?: boolean } = {},
): Promise<InitResult> {
  await db.open();
  const seeded = await ensureSeeded(db);
  const recurring =
    options.runGenerator === false ? { created: 0, transactionIds: [], since: Date.now() } : await runRecurring(today);
  void ensurePersistentStorage();
  return { seeded, recurring };
}
