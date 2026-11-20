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

## Ikon (UI, `src/ui/icons.tsx`)
- `<Icon name size? filled? strokeWidth? label?>` — viewBox 24, stroke 1.5 (1.75 bila size ≤ 18). `filled` = varian tab aktif (bentuk utama isi 12%). Tanpa `label` ikon dianggap dekoratif (`aria-hidden`).
- Semua ID di `src/db/iconIds.ts` (UI + entity) sudah punya glyph. Tambahan UI: `chevron-up, minus, eye, pencil, refresh, sun, moon, star`. Tambahan kategori (konteks Indonesia, belum masuk `ENTITY_ICON_IDS` — tambahkan di data bila ingin bisa dipilih): `motorbike` (ojek), `train` (KRL/MRT), `droplet` (PDAM), `flame` (gas/LPG), `tv` (langganan), `laptop`, `scissors` (salon/potong rambut), `shield` (asuransi), `angpao`, `mosque` (ibadah).
- `CATEGORY_ICON_NAMES` (50, urut untuk grid pemilih), `ICON_NAMES`, `isIconName()`, `<ArusMark size>` (logo; path sama dengan `public/icon.svg`).
- Pemetaan konteks Indonesia: listrik/PLN `bolt`, pulsa `phone`, internet `wifi`, THR/bonus `gift`, zakat/sedekah `hand-heart`, e-wallet `smartphone-wallet`, kartu kredit `card`, tunai `cash`, bank `bank`, lain-lain `dots`.

## Komponen UI (`src/ui`, impor dari `./ui`)
Gaya: `src/styles/tokens.css` (satu-satunya tempat hex), `base.css` (reset, `.num`, `.t-*`, `.ink-*`, `.sr-only`), `components.css` (kelas `.ui-*`). Tema: `applyTheme('system'|'light'|'dark')`, `applyTextScale('standard'|'large'|'larger')` (`src/ui/theme.ts`). Root app wajib: `useViewportVars()` (menulis `--vv-h`, `--kb`, kelas `kb-open`), `<RouterProvider>`, `<ToastProvider>`, `<UpdatePrompt blocked?>`.

| Komponen | Props inti |
|---|---|
| `Screen` | `title, large?=true, back?{label,onBack}, actions?, center?, withTabBar?=true` — nav bar iOS (Large Title → inline > 40 px), area scroll, swipe tepi kiri → back. |
| `TabBar` | `hidden?, showAdd?=true, onAdd?, active?` — 4 tab (rute dari `ROUTES`), FAB 56 px bila `onAdd`. Menulis `--chrome-bottom` agar toast duduk di atas tab bar + FAB. Otomatis tersembunyi saat keyboard aktif. |
| `BottomSheet` | `open, onClose, children, detent?'full'|'auto', title?, ariaLabel?, headerLeft/Center/Right?, footer?, instant?, initialFocus?, disableDrag?` — portal, drag grabber/header (> 25% atau > 0,5 px/ms → tutup), fokus terperangkap, Escape, latar `inert`, posisi di atas keyboard iOS. Bila `onClose` diabaikan induk (mis. konfirmasi), panel kembali sendiri. |
| `ConfirmDialog` | `open, title?, message?, confirmLabel, cancelLabel?='Batal', destructive?=true, onConfirm, onCancel` — action sheet iOS. |
| `Keypad` | `value, onChange, maxDigits?=12, onReject?, variant?'amount'|'pin', onKey?, submit?{label?,disabled?,onSubmit,hint?}, captureKeyboard?, onEscape?, disabled?` — respons `pointerdown`, tahan ⌫ 500 ms = kosongkan, VoiceOver via click `detail===0`. `applyKey(value,key,max)` murni (null = ditolak). |
| `AmountDisplay` | `value, mode?'expense'|'income'|'transfer', shakeKey?` — "Rp" + angka hero, auto-shrink 40/32 px, digit masuk beranimasi; naikkan `shakeKey` untuk geleng. |
| `AmountText` | `value, kind?'expense'|'income'|'transfer'|'balance'|'plain', size?'body'|'title'|'amount-l'|'hero'|'inherit', short?, muted?` — tanda (U+2212) & warna sesuai DESIGN; expense/income/transfer: kirim nilai absolut. |
| `ListGroup` | `inset?=true` — grup `surface` r-14. |
| `ListRow` | `title, subtitle?, leading?, trailing?, trailingSub?, chevron?, onClick?, onDelete?, deleteLabel?, highlight?, subtitleIcon?, disabled?` — 60/48 px, swipe kiri → Hapus 88 px, swipe > 60% → hapus langsung, `highlight` = sorot 1,2 dtk (ganti `key` untuk memicu ulang). |
| `SectionHeader` | `title, trailing?, sticky?, action?{label,onClick}` — header hari: `sticky`; **bungkus header + grupnya dalam satu `<section>`** agar header lepas saat hari berganti. |
| `CategoryIcon` | `icon, color (1–12 | 'c1'–'c12' | 'neutral'), size?32|40|44|56` |
| `CategoryCell` | `icon, color, label, selected?, recent?, onClick?` — taruh di `<div className="ui-cat-grid">` (4 kolom). |
| `SegmentedControl` | `options[{value,label,disabled?}], value, onChange, ariaLabel, block?=true` — radiogroup, panah kiri/kanan. |
| `Button` | `variant?'primary'|'secondary'|'neutral'|'plain'|'destructive', size?'lg'|'md'|'sm', block?, icon?` + atribut button. Kelas `ui-btn--pill` untuk tombol chip besar. |
| `IconButton` | `icon, label (wajib), size?=22, tone?` — target 44×44. |
| `Chip` | `icon?, menu?, active?` — 32 px. |
| `TextField` | `value, onChange(string), label?, icon?, clearable?, hint?, error?` + atribut input (font ≥ 16 px). |
| `Switch` | `checked, onChange, label? | ariaLabel, disabled?` |
| `EmptyState` | `icon, title, description?, action?{label,onClick}` |
| `ProgressBar` | `value, max, today? (0–1), thickness?4|6, status?, ariaLabel?` — status otomatis `budgetStatus()` (< 80% ok, 80–100% warning, > 100% over). |
| `DonutChart` | `segments[{id,value,color,label?}], selectedId?, onSelect?, centerValue?, centerLabel?, ariaLabel, size?=184` — urutkan terbesar dulu; nominal tengah mengecil otomatis. |
| Toast | `useToast().show({message, action?{label,onAction}, duration?=5000 (Infinity = persisten), id?, tone?'error'})`, `.dismiss(id?)`. |
| `UpdatePrompt` | `blocked?` — SW `prompt` + toast "Versi baru tersedia · Muat ulang", `registration.update()` saat kembali terlihat (maks 1×/30 menit). `checkForUpdate()` untuk tombol "Periksa pembaruan". |
| Router | `useRouter() → {path, query, navigate(to,{replace?,state?}), back(fallback?), canGoBack, setQuery(patch)}`, `useParams(pattern)`, `matchPath`, `useSheet() → {sheet, params, open(name, extra?), close()}` (sheet = `?sheet=…`; back menutup sheet), `<Link to>`, `ROUTES`, `tabForPath`, `useEdgeSwipeBack`. |
| Format | `formatRp`, `formatShort`, `formatDigits`, `MINUS` (ringan, untuk komponen; domain memakai `src/lib/money`). |

Dev: `/_gallery` (hanya `npm run dev`) menampilkan semua komponen; `?theme=light|dark&open=input|auto|confirm|toast|update`. Screenshot iPhone 390×844 @3x ada di `docs/screens/`.
