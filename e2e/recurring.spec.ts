/* G. Transaksi berulang (AC-RC-*) dengan jam palsu: lompat tanggal, catch-up, idempoten, tengah malam. */
import { expect, test, type Page } from '@playwright/test'
import { accId, boot, catCell, catId, dumpDb, keys, putRows, reload, toast, transactions, txSheet, type Dump } from './helpers'

const at = (s: string) => new Date(`${s}+07:00`)

function rule(d: Dump, patch: Record<string, unknown>) {
  const now = Date.now()
  return {
    id: 'r-' + Math.random().toString(16).slice(2),
    type: 'expense',
    amount: 2400000,
    accountId: accId(d, 'Rekening Bank'),
    categoryId: catId(d, 'Tempat Tinggal'),
    note: 'Kos',
    frequency: 'monthly',
    interval: 1,
    anchorDate: '2026-11-01',
    generatedCount: 0,
    nextDate: patch.anchorDate ?? '2026-11-01',
    active: 1,
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

const dates = async (page: Page, recurringId?: string) =>
  (await transactions(page)).filter((t) => !recurringId || t.recurringId === recurringId).map((t) => t.date).sort()

test('AC-RC-02/03/04 · app tidak dibuka 1 Nov–3 Des → catch-up 2 transaksi + banner; idempoten; hapus tidak dibuat ulang', async ({ page }) => {
  const d = await boot(page, { time: at('2026-10-31T09:00:00') })
  const r = rule(d, { anchorDate: '2026-11-01' })
  await putRows(page, 'recurring', [r])
  await page.clock.setSystemTime(at('2026-12-03T08:00:00'))
  await reload(page, '/')
  await expect(page.locator('.s-banner', { hasText: 'transaksi berulang dicatat' })).toContainText('2 transaksi berulang dicatat')
  expect(await dates(page, r.id)).toEqual(['2026-11-01', '2026-12-01'])
  // run kedua (reload + visibilitychange) → tidak ada duplikat
  await reload(page)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(500)
  expect(await dates(page, r.id)).toEqual(['2026-11-01', '2026-12-01'])
  const rr = (await dumpDb(page)).recurring[0]
  expect(rr).toMatchObject({ generatedCount: 2, nextDate: '2027-01-01', active: 1 })
  // hapus kejadian 1 Des lalu buka ulang → tidak dibuat ulang
  const dec = (await transactions(page)).find((t) => t.date === '2026-12-01')!
  await page.locator('.s-daylist .ui-row__content', { hasText: 'Kos' }).first().click()
  await page.getByRole('button', { name: 'Hapus transaksi' }).click()
  await expect(txSheet(page)).toBeHidden()
  await reload(page)
  expect(await dates(page, r.id)).toEqual(['2026-11-01'])
  expect((await transactions(page)).some((t) => t.id === dec.id)).toBe(false)
  // banner "Lihat" → /cari berulang
})

test('AC-RC-01 · bulanan anchor 31 Jan 2027 → 31 Jan, 28 Feb, 31 Mar, 30 Apr', async ({ page }) => {
  const d = await boot(page, { time: at('2027-01-30T09:00:00') })
  const r = rule(d, { anchorDate: '2027-01-31' })
  await putRows(page, 'recurring', [r])
  await page.clock.setSystemTime(at('2027-04-30T09:00:00'))
  await reload(page)
  expect(await dates(page, r.id)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
})

test('AC-RC-05/06 · endDate → nonaktif; mingguan interval 2 anchor Senin 2 Nov → 2, 16, 30 Nov', async ({ page }) => {
  const d = await boot(page, { time: at('2026-11-01T09:00:00') })
  const w = rule(d, { frequency: 'weekly', interval: 2, anchorDate: '2026-11-02', note: 'Dua mingguan', amount: 50000 })
  const e = rule(d, { frequency: 'daily', anchorDate: '2026-11-02', endDate: '2026-11-04', note: 'Harian 3x', amount: 1000 })
  await putRows(page, 'recurring', [w, e])
  await page.clock.setSystemTime(at('2026-12-05T09:00:00'))
  await reload(page)
  expect(await dates(page, w.id)).toEqual(['2026-11-02', '2026-11-16', '2026-11-30'])
  expect(await dates(page, e.id)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  const ee = (await dumpDb(page)).recurring.find((x) => x.id === e.id)!
  expect(ee.active).toBe(0)
})

test('AC-RC-07 · chip Ulangi + Simpan hari ini → 1 transaksi + aturan generatedCount=1', async ({ page }) => {
  await boot(page)
  await page.locator('.ui-fab').click()
  await keys(page, ['5', '0', '000'])
  await page.getByRole('button', { name: 'Ulangi' }).click()
  await page.locator('.ui-sheet.is-open').getByText('Tiap bulan', { exact: true }).click()
  await catCell(page, 'Hiburan & Langganan').click()
  await expect(txSheet(page)).toBeHidden()
  await expect(toast(page)).toContainText('Tersimpan')
  const db = await dumpDb(page)
  expect(db.transactions).toHaveLength(1)
  expect(db.recurring).toHaveLength(1)
  expect(db.recurring[0]).toMatchObject({ generatedCount: 1, anchorDate: '2026-11-20', nextDate: '2026-12-20' })
  await reload(page)
  expect((await transactions(page)).length).toBe(1)
})

test('AC-RC-08 · harian sejak 2 tahun lalu → maks 400 per run, sisanya di run berikutnya', async ({ page }) => {
  const d = await boot(page)
  const r = rule(d, { frequency: 'daily', anchorDate: '2024-11-20', amount: 1000, note: 'Harian lama' })
  await putRows(page, 'recurring', [r])
  const t0 = Date.now()
  await reload(page)
  // BUG-12: layar pertama tidak menunggu generator (sebelumnya ±6,6 dtk di WebKit Windows).
  const screenMs = Date.now() - t0
  await expect.poll(async () => (await dates(page, r.id)).length, { timeout: 20_000 }).toBe(400)
  console.log(`[AC-RC-08] layar tampil ${screenMs} ms; 400 kejadian tercatat ${Date.now() - t0} ms`)
  expect(screenMs, 'layar pertama tidak boleh menunggu generator').toBeLessThan(3000)
  await reload(page)
  await expect.poll(async () => (await dates(page, r.id)).length, { timeout: 20_000 }).toBe(731) // 20 Nov 2024 … 20 Nov 2026 inklusif
})

test('AC-RC-09 · aktifkan lagi aturan dijeda: "Catat yang terlewat (N)" membuat N transaksi', async ({ page }) => {
  const d = await boot(page)
  const r = rule(d, { anchorDate: '2026-08-01', active: 0, generatedCount: 1, nextDate: '2026-09-01' })
  await putRows(page, 'recurring', [r])
  await reload(page, '/pengaturan/berulang')
  await page.locator('.ui-row__content', { hasText: 'Kos' }).click()
  await page.locator('.ui-switch-row', { hasText: 'Aktif' }).click()
  const opt = page.getByRole('button', { name: /Catat yang terlewat \(3\)/ })
  await expect(opt).toBeVisible()
  await opt.click()
  await expect.poll(async () => (await dates(page, r.id)).length).toBe(3)
  expect(await dates(page, r.id)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
})

test('AC-RC-09b · "Lewati" memajukan generatedCount tanpa transaksi', async ({ page }) => {
  const d = await boot(page)
  const r = rule(d, { anchorDate: '2026-08-01', active: 0, generatedCount: 1, nextDate: '2026-09-01' })
  await putRows(page, 'recurring', [r])
  await reload(page, '/pengaturan/berulang')
  await page.locator('.ui-row__content', { hasText: 'Kos' }).click()
  await page.locator('.ui-switch-row', { hasText: 'Aktif' }).click()
  await page.getByRole('button', { name: /Lewati/ }).click()
  await expect.poll(async () => (await dumpDb(page)).recurring[0].nextDate).toBe('2026-12-01')
  expect(await dates(page, r.id)).toEqual([])
})

test('AC-RC-10 · akun aturan diarsipkan → aturan nonaktif, tidak ada transaksi baru', async ({ page }) => {
  const d = await boot(page, { time: at('2026-10-30T09:00:00') })
  const r = rule(d, { anchorDate: '2026-11-01' })
  await putRows(page, 'recurring', [r])
  await putRows(page, 'accounts', d.accounts.map((a) => (a.id === r.accountId ? { ...a, archived: 1 } : a)))
  await page.clock.setSystemTime(at('2026-11-02T09:00:00'))
  await reload(page)
  expect(await dates(page, r.id)).toEqual([])
  expect((await dumpDb(page)).recurring[0].active).toBe(0)
})

test('Tengah malam saat app terbuka: 23:59 → 00:01 membuat kejadian baru & label "Hari ini" bergeser', async ({ page }) => {
  const d = await boot(page, { time: at('2026-11-30T23:58:30') })
  const r = rule(d, { anchorDate: '2026-12-01', amount: 186000, note: 'Netflix' })
  await putRows(page, 'recurring', [r])
  await putRows(page, 'transactions', [
    { id: 'tx-malam', type: 'expense', amount: 15000, date: '2026-11-30', accountId: accId(d, 'Tunai'), categoryId: catId(d, 'Makan & Minum'), note: 'Nasi goreng malam', createdAt: Date.now(), updatedAt: Date.now() },
  ])
  await reload(page)
  await expect(page.locator('.s-daylist section').first().locator('.ui-section__title')).toHaveText('Hari ini')
  await page.clock.fastForward('03:00') // lewat 00:00, interval 60 dtk berjalan
  await expect.poll(async () => dates(page, r.id), { timeout: 10_000 }).toEqual(['2026-12-01'])
  await expect(page.locator('.s-daylist section', { hasText: 'Nasi goreng malam' }).locator('.ui-section__title')).toHaveText('Kemarin')
})

// BUG-02: toast tak terlihat (is-leaving, opacity 0) tetap menangkap tap di atas baris bawah keypad
test('Simpan transaksi pukul 23:59:59 WIB → tanggal hari itu; 00:00:01 → tanggal berikutnya', async ({ page }) => {
  await boot(page, { time: at('2026-11-30T23:59:50') })
  await page.locator('.ui-fab').click()
  await keys(page, ['1', '000'])
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  test.setTimeout(30_000)
  await page.clock.fastForward('00:20')
  await page.locator('.ui-fab').click()
  await expect(page.locator('.tx-sheet__ctx')).toContainText('Hari ini')
  await keys(page, ['2', '000'])
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  expect((await transactions(page)).map((t) => `${t.date}:${t.amount}`).sort()).toEqual(['2026-11-30:1000', '2026-12-01:2000'])
})

test('29 Februari 2028: tahunan anchor 29 Feb → 28 Feb 2029; input transaksi di 29 Feb', async ({ page }) => {
  const d = await boot(page, { time: at('2028-02-29T12:00:00') })
  const r = rule(d, { frequency: 'yearly', anchorDate: '2028-02-29', amount: 1000000, note: 'Pajak tahunan' })
  await putRows(page, 'recurring', [r])
  await reload(page)
  await page.locator('.ui-fab').click()
  await keys(page, ['7', '000'])
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  expect((await transactions(page)).filter((t) => !t.recurringId)[0].date).toBe('2028-02-29')
  await page.clock.setSystemTime(at('2029-03-01T09:00:00'))
  await reload(page)
  expect(await dates(page, r.id)).toEqual(['2028-02-29', '2029-02-28'])
})
