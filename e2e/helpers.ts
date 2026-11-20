/*
 * Helper e2e Arus. Data uji ditulis langsung ke IndexedDB (DB "arus", Dexie v1 = IDB v10)
 * lalu halaman dimuat ulang — build produksi tidak memuat scripts/demo-seed.ts.
 */
import { expect, type Locator, type Page } from '@playwright/test'

export const NBSP = String.fromCharCode(0xa0)
export const MINUS = String.fromCharCode(0x2212)
/** "Hari ini" default semua tes: Jumat 20 Nov 2026 10:00 WIB. */
export const TODAY = '2026-11-20'
export const NOW = new Date('2026-11-20T10:00:00+07:00')

/** Format seperti app: "Rp 1.250.000" (NBSP). */
export const rp = (n: number) => `Rp${NBSP}${Math.abs(n).toLocaleString('de-DE')}`

export type Store = 'accounts' | 'categories' | 'transactions' | 'budgets' | 'recurring' | 'templates' | 'settings'
export type Row = Record<string, unknown> & { id?: string; key?: string }
export type Dump = Record<Store, Row[]>

/** Pasang jam palsu yang tetap berjalan, mulai `time`. Panggil SEBELUM goto. */
export async function installClock(page: Page, time: Date = NOW) {
  await page.clock.install({ time })
  await page.clock.resume()
}

/** Kumpulkan error/warning console & pageerror. */
export function collectConsole(page: Page) {
  const out: { type: string; text: string }[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') out.push({ type: m.type(), text: m.text() })
  })
  page.on('pageerror', (e) => out.push({ type: 'pageerror', text: e.message }))
  return out
}

// ------------------------------------------------------------------ IndexedDB mentah

export async function dumpDb(page: Page): Promise<Dump> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('arus')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const names = Array.from(db.objectStoreNames)
    const out: Record<string, unknown[]> = {}
    await Promise.all(
      names.map(
        (n) =>
          new Promise<void>((res, rej) => {
            const q = db.transaction(n, 'readonly').objectStore(n).getAll()
            q.onsuccess = () => {
              out[n] = q.result
              res()
            }
            q.onerror = () => rej(q.error)
          }),
      ),
    )
    db.close()
    return out
  }) as Promise<Dump>
}

/** put (upsert) record ke store; `clear` = kosongkan store dulu. */
export async function putRows(page: Page, store: Store, rows: Row[], clear = false) {
  await page.evaluate(
    async ({ store, rows, clear }) => {
      const db: IDBDatabase = await new Promise((res, rej) => {
        const r = indexedDB.open('arus')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(store, 'readwrite')
        const os = tx.objectStore(store)
        if (clear) os.clear()
        for (const r of rows) os.put(r)
        tx.oncomplete = () => res()
        tx.onerror = () => rej(tx.error)
      })
      db.close()
    },
    { store, rows, clear },
  )
}

export async function setSettingsRaw(page: Page, values: Record<string, unknown>) {
  await putRows(
    page,
    'settings',
    Object.entries(values).map(([key, value]) => ({ key, value })),
  )
}

export async function getSetting(page: Page, key: string): Promise<unknown> {
  const d = await dumpDb(page)
  return d.settings.find((s) => s.key === key)?.value
}

export async function transactions(page: Page) {
  return (await dumpDb(page)).transactions as unknown as TxRow[]
}

export interface TxRow {
  id: string
  type: 'expense' | 'income' | 'transfer' | 'adjustment'
  amount: number
  date: string
  accountId: string
  toAccountId?: string
  categoryId?: string
  note?: string
  recurringId?: string
  createdAt: number
  updatedAt: number
}

// ------------------------------------------------------------------ boot

export interface BootOptions {
  /** Default: jam palsu NOW. `null` = jam asli. */
  time?: Date | null
  /** Pengaturan tambahan setelah seed (default menyembunyikan banner pasang & openToAdd=false). */
  settings?: Record<string, unknown>
  /** Path setelah boot (default '/'). */
  path?: string
}

/**
 * Buka app pertama kali (seed + onboarding), lewati onboarding, tulis pengaturan standar,
 * lalu muat ulang ke `path`. Mengembalikan dump setelah seed.
 */
export async function boot(page: Page, opts: BootOptions = {}): Promise<Dump> {
  if (opts.time !== null) await installClock(page, opts.time ?? NOW)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Mulai mencatat' })).toBeVisible({ timeout: 15_000 })
  await setSettingsRaw(page, {
    installHintDismissedAt: (opts.time ?? NOW).getTime(),
    openToAdd: false,
    lastBackupAt: (opts.time ?? NOW).getTime(),
    ...opts.settings,
  })
  await page.goto(opts.path ?? '/')
  await waitReady(page)
  return dumpDb(page)
}

export async function waitReady(page: Page) {
  await page.waitForSelector('.ui-screen, .s-lock, .s-onboard, .ui-sheet', { timeout: 15_000 })
}

export async function reload(page: Page, path?: string) {
  if (path) await page.goto(path)
  else await page.reload()
  await waitReady(page)
}

// ------------------------------------------------------------------ data uji

export interface TxSpec {
  type?: TxRow['type']
  amount: number
  date?: string
  account?: string
  to?: string
  category?: string
  note?: string
  recurringId?: string
}

let seq = 0
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

/** Ubah spesifikasi (nama akun/kategori) jadi record transaksi. */
export function buildTx(d: Dump, specs: TxSpec[], baseTime = NOW.getTime() - 86_400_000): TxRow[] {
  const acc = (name: string) => {
    const a = d.accounts.find((x) => x.name === name)
    if (!a) throw new Error(`akun ${name} tidak ada`)
    return a.id as string
  }
  return specs.map((s) => {
    const type = s.type ?? 'expense'
    const kind = type === 'income' ? 'income' : 'expense'
    let categoryId: string | undefined
    if (type === 'expense' || type === 'income') {
      const c = d.categories.find((x) => x.name === (s.category ?? (type === 'income' ? 'Gaji' : 'Makan & Minum')) && x.kind === kind)
      if (!c) throw new Error(`kategori ${s.category} tidak ada`)
      categoryId = c.id as string
    }
    const t = baseTime + ++seq * 1000
    const row: TxRow = {
      id: uuid(),
      type,
      amount: s.amount,
      date: s.date ?? TODAY,
      accountId: acc(s.account ?? 'Tunai'),
      createdAt: t,
      updatedAt: t,
    }
    if (categoryId) row.categoryId = categoryId
    if (type === 'transfer') row.toAccountId = acc(s.to ?? 'Rekening Bank')
    if (s.note) row.note = s.note
    if (s.recurringId) row.recurringId = s.recurringId
    return row
  })
}

/** Tambah transaksi mentah lalu muat ulang. */
export async function seedTx(page: Page, d: Dump, specs: TxSpec[], path?: string) {
  const rows = buildTx(d, specs)
  await putRows(page, 'transactions', rows as unknown as Row[])
  await reload(page, path)
  return rows
}

export async function setOpening(page: Page, d: Dump, balances: Record<string, number>) {
  const rows = d.accounts.map((a) => (a.name as string) in balances ? { ...a, openingBalance: balances[a.name as string] } : a)
  await putRows(page, 'accounts', rows)
}

export const catId = (d: Dump, name: string, kind: 'expense' | 'income' = 'expense') =>
  d.categories.find((c) => c.name === name && c.kind === kind)!.id as string
export const accId = (d: Dump, name: string) => d.accounts.find((a) => a.name === name)!.id as string

// ------------------------------------------------------------------ UI

export const sheet = (page: Page) => page.locator('.ui-sheet.is-open, .ui-sheet[data-open="true"]').last()
export const txSheet = (page: Page) => page.locator('.ui-sheet.tx-sheet.is-open')
export const keypad = (page: Page) => page.getByRole('group', { name: 'Keypad nominal' }).last()

/** Tap tombol keypad (pointerdown). */
export async function keys(page: Page, seq: string[]) {
  for (const k of seq) {
    const name = k === '000' ? 'Tiga nol' : k === 'back' ? 'Hapus satu digit' : k
    await keypad(page).getByRole('button', { name, exact: true }).click()
  }
}

/** Nominal yang tampil di sheet input (aria-label "Rp 25.000"). */
export async function amountShown(page: Page): Promise<string> {
  return norm(await page.locator('.tx-sheet .ui-amount-display').getAttribute('aria-label'))
}

export const catCell = (page: Page, name: string) =>
  page.locator('.tx-sheet .ui-cat-cell').filter({ has: page.locator('.ui-cat-cell__label', { hasText: new RegExp(`^${escapeRe(name)}$`) }) })

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function openAdd(page: Page) {
  await page.locator('.ui-fab').click()
  await expect(txSheet(page)).toBeVisible()
}

export const toast = (page: Page) => page.locator('.ui-toast')

export async function tabTo(page: Page, name: 'Transaksi' | 'Ringkasan' | 'Anggaran' | 'Akun') {
  await page.locator('.ui-tabbar').getByRole('link', { name }).click()
}

/** Teks dengan NBSP/minus dinormalisasi ke spasi & '-'. */
export const norm = (s: string | null | undefined) => (s ?? '').replace(/\u00A0/g, ' ').replace(/\u2212/g, '-').replace(/\s+/g, ' ').trim()

export async function textOf(l: Locator) {
  return norm(await l.innerText())
}

/** Angka integer pertama dari teks "−Rp 1.250.000" → 1250000 (tanpa tanda). */
export const digits = (s: string) => Number((s.match(/[\d.]+/)?.[0] ?? '0').replace(/\./g, ''))

/** Swipe kiri pada baris (pointer mouse). */
export async function swipeLeft(page: Page, row: Locator, dist = 140) {
  const b = (await row.boundingBox())!
  const y = b.y + b.height / 2
  const x = b.x + b.width - 30
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(x - (dist * i) / 8, y)
  await page.mouse.up()
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/screens/qa-${name}.png` })
}
