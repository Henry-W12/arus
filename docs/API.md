# API lapisan data — Arus

Untuk agent layar. Semua nominal = integer Rupiah, tanggal bisnis = `LocalDate` (`'YYYY-MM-DD'` lokal), periode = `PeriodKey` (`'YYYY-MM'`, bulan dari tanggal akhir periode). Jangan pernah memakai `toISOString()` untuk tanggal (ada tes penjaga).

```
src/db/   schema.ts (tipe + DEFAULT_SETTINGS), iconIds.ts, db.ts (Dexie), seed.ts, repo.ts (semua tulis), backup.ts, init.ts
src/lib/  fungsi murni: money, dates, period, balances, summary, budget, recurring, search, csv, backup, validation, pin, storage
          hooks.ts (React, useLiveQuery)
```
Tes: `npm test`. Error dari repo dilempar sebagai `RepoError` (`src/lib/errors.ts`) dengan `code` (`invalid | not-found | duplicate-name | has-transactions | last-active | limit-reached`) dan `message` bahasa Indonesia yang siap ditampilkan.

## Start app
```ts
import { initDatabase } from './db/init';
const { recurring } = await initDatabase();     // open + seed + runRecurring + storage.persist()
if (recurring.created) showBanner(`${recurring.created} transaksi berulang dicatat`); // filter: { recurringOnly: true, createdSince: recurring.since }
```
Panggil juga `runRecurring()` saat `visibilitychange → visible` dan saat `useToday()` berganti. `onDatabaseVersionChange(cb)` (db.ts) → tampilkan "Muat ulang".

## Ikon & warna (`src/db/iconIds.ts`)
- `UI_ICON_IDS` (28 ikon antarmuka), `ENTITY_ICON_IDS` (40 ikon kategori/akun), `ACCOUNT_ICON_IDS` (12 untuk grid akun). Tipe `IconName` = nilai field `icon`. **Setiap ID wajib punya SVG di `<Icon>`.**
- `COLOR_TOKENS` = `'c1'…'c12'` (CSS var `--c1`…).

## Hooks (`src/lib/hooks.ts`)
Semua mengembalikan `undefined` saat memuat, lalu live-update.

| Hook | Hasil |
|---|---|
| `useToday(): LocalDate` | hari ini lokal, refresh tiap 60 dtk & `visibilitychange` |
| `useSettings(): Settings` | semua setting + default |
| `useAccounts({ includeArchived? }): Account[]` | urut `sortOrder` |
| `useCategories(kind?, { includeArchived? }): Category[]` | urut grid input |
| `useLookup(): { accounts: Map, categories: Map }` | termasuk arsip (nama di riwayat) |
| `useCurrentPeriod() / usePeriod(key?): Period` | `{ key, start, end }` sesuai `periodStartDay` |
| `usePeriodTransactions(key?)` | `{ period, groups: DayGroup[], totals, count }` — `DayGroup = { date, items, net }` |
| `useTransactionsInRange(from, to)`, `useTransactionsAfter(date)`, `useAllTransactions()` | `Transaction[]` |
| `useBalances()` | `{ balances: Map<id,n>, scheduled: Map, total, accounts }` (`balances` = per hari ini) |
| `useAccountDetail(id)` | `{ account, balance, scheduledBalance, groups, running: Map<txId, saldo> }` atau `null` |
| `usePeriodSummary(key, kind='expense')` | `{ period, totals, previousTotals, delta, breakdown, segments, trend, firstKey }` |
| `useBudgetOverview(key?)` | `BudgetOverview` (lihat budget) |
| `useSearch(filter: SearchFilter)` | `{ items, count, totals }` — memo-kan objek filter, debounce 150 ms di UI |
| `useRecentNotes(categoryId)` | 5 catatan terakhir |
| `useTemplates()`, `useRecurringRules()`, `useDataCounts()`, `useBackupReminder()` | |

```tsx
const today = useToday();
const data = usePeriodTransactions();               // periode berjalan
data?.groups.map(g => <DayHeader label={dayLabel(g.date, today)} net={g.net} />)
```

## Tulis (`src/db/repo.ts`)
```ts
addTransaction({ type, amount, date, accountId, categoryId?, toAccountId?, note? }): Promise<Transaction> // set lastAccountId
updateTransaction(id, patch)        // field = undefined → dihapus (mis. ganti jenis), createdAt tetap
deleteTransaction(id): Promise<Transaction|undefined>   // simpan untuk Urungkan
restoreTransaction(tx)              // Urungkan hapus/edit (id sama). Urungkan simpan baru = deleteTransaction
addTransfer({ fromAccountId, toAccountId, amount, date, note? })
adjustBalance(accountId, saldoNyata, today?): Promise<Transaction|null>  // null jika selisih 0
getAccountBalance(accountId, asOf?)

createAccount({ name, type, icon, color, openingBalance, includeInTotal }) / updateAccount(id, patch)
archiveAccount(id): { deactivatedRules }   countActiveRulesForAccount(id)  // untuk teks konfirmasi
unarchiveAccount(id)  canDeleteAccount(id)  deleteAccount(id)  reorderAccounts(ids)
createCategory({ kind, name, icon, color }) / updateCategory(id, { name?, icon?, color? })
archiveCategory / unarchiveCategory / canDeleteCategory / deleteCategory / reorderCategories(ids)

setBudget(categoryId, periodKey, amount)   // upsert, berlaku mulai periode itu; removeBudget(categoryId, periodKey) = amount 0

createRecurring(rule, today?): { rule, run }   // anchor ≤ today langsung dibuat (anchor hari ini = 1 transaksi)
updateRecurring(id, patch, today?): { rule, run } // ubah anchor/frekuensi/interval → hitung ulang dari anchor baru
pauseRecurring(id)   countMissedOccurrences(id, today?)   resumeRecurring(id, 'catch-up' | 'skip', today?)
countFutureTransactionsOfRule(id)   deleteRecurring(id, { deleteFuture? })
runRecurring(today?): { created, transactionIds, since }   // idempoten, maks 400/aturan/run

createTemplate / updateTemplate / deleteTemplate / reorderTemplates   // maks 12 → RepoError 'limit-reached'
applyTemplate(id, today?): Promise<Transaction>   // simpan instan + useCount++

getSettings() / getSetting(key) / setSetting(key, value) / setSettings(partial)
resolveDefaultAccountId(settings, accounts)   // akun awal sheet input
getDataCounts()   resetAllData()              // "Hapus semua data" → seed ulang (PIN ikut terhapus)
```
Pratinjau jumlah kejadian sebelum menyimpan aturan baru/ubah anchor: `countDue({ frequency, interval, anchorDate, endDate, generatedCount: 0 }, today)` dari `lib/recurring`.

## Backup, CSV, share (`src/db/backup.ts`, `src/lib/backup.ts`, `src/lib/storage.ts`)
```ts
// Buat backup (langsung dari handler tap)
const file = await createBackupFile();
const outcome = await shareOrDownloadFile(file);      // 'shared' | 'downloaded' | 'cancelled'
if (outcome !== 'cancelled') { await markBackupDone(); toast('Backup dibuat'); }

// Restore
const res = parseBackup(await file.text());           // validasi penuh, tidak menulis apa pun
if (!res.ok) return toast(res.message);               // mis. "File backup tidak valid: 3 transaksi merujuk akun yang tidak ada."
const p = await previewRestore(res.backup);           // { exportedAt, backup: counts, current: counts }
await restoreBackup(res.backup);                      // atomik; gagal → data lama utuh. PIN perangkat dipertahankan

// CSV
await shareOrDownloadFile(await createCsvFile({ kind: 'all' }));
await shareOrDownloadFile(await createCsvFile({ kind: 'range', from: p.start, to: p.end, label: p.key }));
```
Lainnya: `ensurePersistentStorage()`, `getStorageEstimate()`, `formatBytes(n)` ("1,2 MB"), `isStandalone()`, `shouldShowBackupReminder(...)`, `snoozeBackupReminder()` ("Nanti"), `describeLastBackup(ts)` ("3 hari lalu").

## Fungsi murni (`src/lib/*`)
**money**: `formatIDR(n, sign='negative'|'always'|'none')` → `Rp 1.250.000` / `−Rp 25.000` / `+Rp 25.000` (NBSP, U+2212) · `formatIDRShort(n, { withRp?, sign? })` → `25rb`, `1,2jt`, `1,2M` · `formatNumber(n)` · `formatPercent(ratio)` → `64%`, `<1%` · `parseAmountText('1,2jt')` → 1200000 | null · `applyKeypad(value, key)` → `{ value, rejected }` (`key`: `'0'..'9' | '000' | 'backspace' | 'clear'`; `rejected` = animasi geleng) · `formatKeypadDisplay(n)`.

**dates**: `todayLocal()`, `toLocalDate(date)`, `isValidLocalDate`, `localDateToDate`, `addDays`, `addMonthsClamped`, `diffDays`, `daysInMonth`, `weekdayMon0` (Senin=0), `formatDateLong` ("Jumat, 20 November 2026"), `formatDateMedium` ("20 Nov 2026"), `formatDayHeader` ("Kam, 12 Nov"), `dayLabel(date, today)` ("Hari ini" / "Kemarin" / "Terjadwal · Sel, 1 Des"), `MONTHS_*`, `WEEKDAYS_*`.

**period**: `periodOf(date, S)`, `periodByKey(key, S)`, `shiftPeriod(key, ±n)`, `lastPeriods(key, n)`, `formatPeriodLabel` ("November 2026"), `formatPeriodShort` ("Nov 2026"), `formatPeriodRange` ("25 Okt – 24 Nov"), `daysRemaining(today, period)`.

**balances**: `computeBalances(accounts, txs, asOf?)`, `totalBalance(accounts, map)`, `transactionEffect(tx, accountId)` (tanda nominal di detail akun), `runningBalances(account, txs)`, `compareNewestFirst`.

**summary**: `totalsOf`, `periodTotals`, `categoryBreakdown(txs, kind, period?)`, `donutSegments(rows, 6)` (`categoryId: null` = "Lainnya"), `deltaRatio(cur, prev)` (null → "—"), `groupByDay`, `periodTrend(txs, key, S, 6)`.

**budget**: `effectiveBudget(budgets, categoryId, key)`, `budgetStatus(spent, budget)` → `normal|warning|over`, `dailyAllowance`, `budgetOverview(...)` → `{ period, lines[{categoryId,budget,spent,remaining,ratio,status}], unbudgeted, total, perDay }`.

**recurring**: `occurrence(schedule, k)`, `planRecurring(rule, today)`, `countDue`, `skipDue`, `describeSchedule` ("tiap bulan tgl 1").

**search**: `searchTransactions(txs, filter, lookup)`, `SearchFilter { query, types, categoryIds, accountIds, dateFrom, dateTo, minAmount, maxAmount, recurringOnly, createdSince }`, `isFilterEmpty`, `datePresetRange('thisPeriod'|'lastPeriod'|'last3Periods'|'thisYear', today, S)`, `searchSuggestions(txs)`, `normalizeText`.

**pin**: `hashPin(pin)` → `{hash,salt,iterations}` (PBKDF2-SHA-256, 150.000 iterasi) · `verifyPin(pin, record)` · `nextPinLockState(state, success, now)` · `pinLockRemainingMs(state, now)` · `shouldLockOnResume(hiddenAt, now, autoLockMinutes)`. Simpan dengan `setSetting('pin', …)` dan `setSetting('pinLockState', …)`.

**validation**: `transactionIssues(x)` dll. (untuk form: kosong = valid), `nameIssue(name, max)`, `normalizeNote`.

## Settings (`DEFAULT_SETTINGS`, schema.ts)
`periodStartDay` (1–28, di-clamp), `theme`, `textScale`, `defaultAccount`, `lastAccountId`, `openToAdd`, `backupReminderDays`, `lastBackupAt`, `txCountAtLastBackup`, `backupReminderSnoozedUntil`, `persistGranted`, `pin`, `pinLockState`, `autoLockMinutes`, `seededAt`, `installHintDismissedAt`. Key khusus perangkat (`DEVICE_ONLY_SETTING_KEYS`) tidak ikut backup.
