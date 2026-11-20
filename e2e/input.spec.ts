/* A. Input cepat (AC-IN-*) + B. daftar (AC-LS-*). */
import { expect, test } from '@playwright/test'
import {
  amountShown,
  boot,
  catCell,
  catId,
  dumpDb,
  keypad,
  keys,
  openAdd,
  rp,
  seedTx,
  setSettingsRaw,
  swipeLeft,
  TODAY,
  toast,
  transactions,
  txSheet,
  reload,
  textOf,
  installClock,
} from './helpers'

test('AC-IN-01 · cold start openToAdd=true membuka sheet input (Keluar, akun terakhir, hari ini)', async ({ page }) => {
  const d = await boot(page)
  const bank = d.accounts.find((a) => a.name === 'Rekening Bank')!.id
  await setSettingsRaw(page, { openToAdd: true, lastAccountId: bank })
  const t0 = Date.now()
  await page.goto('/')
  await expect(txSheet(page)).toBeVisible()
  const ms = Date.now() - t0
  expect(ms, `sheet terbuka dalam ${ms} ms`).toBeLessThan(1500)
  await expect(page.locator('.tx-sheet__seg [role=radio][aria-checked=true]')).toHaveText('Keluar')
  await expect(page.locator('.tx-sheet__ctx')).toContainText('Rekening Bank')
  await expect(page.locator('.tx-sheet__ctx')).toContainText('Hari ini')
})

test('AC-IN-02 · 25.000 Makan & Minum tersimpan dalam 4 tap + toast + baris teratas', async ({ page }) => {
  await boot(page)
  await openAdd(page) // tap FAB (resume): tidak dihitung dalam 4 tap
  await keys(page, ['2', '5', '000'])
  expect(await amountShown(page)).toBe('Rp 25.000')
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  await expect(toast(page)).toContainText('Tersimpan')
  await expect(toast(page)).toContainText('Urungkan')
  const txs = await transactions(page)
  expect(txs).toHaveLength(1)
  expect(txs[0]).toMatchObject({ type: 'expense', amount: 25000, date: TODAY })
  const first = page.locator('.s-daylist section').first()
  await expect(first.locator('.ui-section__title')).toHaveText('Hari ini')
  await expect(first.locator('.ui-row').first()).toContainText('Makan & Minum')
})

test('AC-IN-03 · Urungkan setelah simpan menghapus transaksi & saldo kembali', async ({ page }) => {
  await boot(page)
  const before = await textOf(page.locator('.s-hero__value'))
  await openAdd(page)
  await keys(page, ['5', '000'])
  await catCell(page, 'Transportasi').click()
  await expect(page.locator('.s-hero__value')).not.toHaveText(before)
  await toast(page).getByRole('button', { name: 'Urungkan' }).click()
  await expect.poll(async () => (await transactions(page)).length).toBe(0)
  await expect(page.locator('.s-hero__value')).toHaveText(before)
})

test('AC-IN-04 · kategori dulu saat nominal 0 tidak menyimpan; Simpan nonaktif lalu aktif', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await catCell(page, 'Makan & Minum').click()
  await expect(catCell(page, 'Makan & Minum')).toHaveAttribute('aria-pressed', 'true')
  const save = page.locator('.tx-sheet .ui-keypad__submit button')
  await expect(save).toBeVisible()
  await expect(save).toBeDisabled()
  expect(await transactions(page)).toHaveLength(0)
  await keys(page, ['5', '000'])
  await expect(save).toBeEnabled()
  await save.click()
  await expect(txSheet(page)).toBeHidden()
  const txs = await transactions(page)
  expect(txs).toHaveLength(1)
  expect(txs[0].amount).toBe(5000)
})

test('AC-IN-05/07/08 · batas 12 digit, 000 terpotong, 0 diabaikan, format ribuan', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await keys(page, ['0', '000'])
  expect(await amountShown(page)).toBe('Rp 0')
  await keys(page, ['1', '2', '5', '0', '000'])
  expect(await amountShown(page)).toBe('Rp 1.250.000')
  // 10 digit lalu 000 → hanya 2 digit
  await keys(page, ['back', 'back', 'back', 'back', 'back', 'back', 'back'])
  await keys(page, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '000'])
  expect(await amountShown(page)).toBe('Rp 123.456.789.000')
  await keys(page, ['9'])
  expect(await amountShown(page)).toBe('Rp 123.456.789.000')
  await expect(page.locator('.tx-sheet .ui-amount-display')).not.toContainText(',')
})

test('AC-IN-06 · tekan lama ⌫ ≥500 ms mengosongkan nominal', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await keys(page, ['9', '8', '7', '6'])
  const back = keypad(page).getByRole('button', { name: 'Hapus satu digit' })
  const b = (await back.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
  expect(await amountShown(page)).toBe('Rp 0')
})

test('AC-IN-09 · tanggal Kemarin → date kemarin & grup "Kemarin"', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await keys(page, ['1', '5', '000'])
  await page.locator('.tx-sheet__ctx .ui-chip', { hasText: 'Hari ini' }).click()
  await page.getByRole('button', { name: 'Kemarin', exact: true }).click()
  await expect(page.locator('.tx-sheet__ctx')).toContainText('Kemarin')
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  const txs = await transactions(page)
  expect(txs[0].date).toBe('2026-11-19')
  await expect(page.locator('.s-daylist section').first().locator('.ui-section__title')).toHaveText('Kemarin')
})

test('AC-IN-10 · jam 05:30 WIB → tanggal lokal (bukan UTC kemarin)', async ({ page }) => {
  await boot(page, { time: new Date('2026-11-20T05:30:00+07:00') })
  await openAdd(page)
  await keys(page, ['1', '000'])
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()
  expect((await transactions(page))[0].date).toBe('2026-11-20')
})

test('AC-IN-11 · favorit 1 tap', async ({ page }) => {
  const d = await boot(page)
  const now = Date.now()
  await page.evaluate(() => 0)
  const { putRows } = await import('./helpers')
  await putRows(page, 'templates', [
    { id: 'tpl-kopi', label: 'Kopi', type: 'expense', amount: 25000, categoryId: catId(d, 'Makan & Minum'), note: 'Kopi', sortOrder: 0, useCount: 0, createdAt: now, updatedAt: now },
  ])
  await reload(page)
  await openAdd(page)
  await page.locator('.tx-fav', { hasText: 'Kopi' }).click()
  await expect(txSheet(page)).toBeHidden()
  await expect(toast(page)).toContainText('Urungkan')
  const txs = await transactions(page)
  expect(txs).toHaveLength(1)
  expect(txs[0]).toMatchObject({ amount: 25000, note: 'Kopi', date: TODAY, categoryId: catId(d, 'Makan & Minum') })
})

test('AC-IN-12 · Batal: mode baru tanpa dialog; mode edit berubah → "Buang perubahan?"', async ({ page }) => {
  const d = await boot(page)
  await openAdd(page)
  await keys(page, ['7', '000'])
  await page.locator('.tx-sheet .s-sheet-btn', { hasText: 'Batal' }).click()
  await expect(txSheet(page)).toBeHidden()
  await expect(page.getByText('Buang perubahan?')).toHaveCount(0)
  await seedTx(page, d, [{ amount: 30000, note: 'Edit saya' }])
  await page.locator('.s-daylist .ui-row__content', { hasText: 'Edit saya' }).click()
  await expect(txSheet(page)).toBeVisible()
  await keys(page, ['5'])
  await page.locator('.tx-sheet .s-sheet-btn', { hasText: 'Batal' }).click()
  await expect(page.getByText('Buang perubahan?')).toBeVisible()
})

test('AC-IN-13 · input catatan font ≥16px', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await page.locator('.tx-sheet__note-chip').click()
  const input = page.getByPlaceholder('Mis. kopi dengan klien')
  await expect(input).toBeFocused()
  const fs = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(fs).toBeGreaterThanOrEqual(16)
})

test('AC-IN-15 · /?add=1 membuka sheet input', async ({ page }) => {
  await boot(page)
  await page.goto('/?add=1')
  await expect(txSheet(page)).toBeVisible()
})

test('Keyboard fisik: digit + Enter menyimpan, Escape menutup', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await catCell(page, 'Belanja').click()
  for (const k of '42000') await page.keyboard.press(k)
  await page.keyboard.press('Enter')
  await expect(txSheet(page)).toBeHidden()
  expect((await transactions(page))[0].amount).toBe(42000)
  await openAdd(page)
  await page.keyboard.press('Escape')
  await expect(txSheet(page)).toBeHidden()
})

// ------------------------------------------------------------ daftar

test('AC-LS-01/02 · urutan per hari, label, total harian abaikan transfer & penyesuaian', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-12', note: 'Lama' },
    { amount: 20000, date: TODAY, note: 'Pertama' },
    { amount: 35000, date: TODAY, note: 'Kedua' },
    { type: 'income', amount: 500000, date: TODAY, category: 'Gaji' },
    { type: 'transfer', amount: 999000, date: TODAY, account: 'Rekening Bank', to: 'Tunai' },
    { type: 'adjustment', amount: -7000, date: TODAY },
    { amount: 10000, date: '2026-11-19' },
  ])
  const sections = page.locator('.s-daylist section')
  await expect(sections.nth(0).locator('.ui-section__title')).toHaveText('Hari ini')
  await expect(sections.nth(1).locator('.ui-section__title')).toHaveText('Kemarin')
  await expect(sections.nth(2).locator('.ui-section__title')).toHaveText('Kam, 12 Nov')
  // createdAt menurun: Kedua sebelum Pertama
  const titles = await sections.nth(0).locator('.ui-row__title').allInnerTexts()
  expect(titles.indexOf('Kedua')).toBeLessThan(titles.indexOf('Pertama'))
  // net hari ini = 500000 − 55000 = +445.000
  expect(await textOf(sections.nth(0).locator('.ui-section__trail'))).toContain('445.000')
})

test('AC-LS-03 · swipe kiri → Hapus → Urungkan mengembalikan id sama', async ({ page }) => {
  const d = await boot(page)
  const [row] = await seedTx(page, d, [{ amount: 12345, note: 'Geser saya' }])
  const r = page.locator('.s-daylist .ui-row', { hasText: 'Geser saya' })
  await swipeLeft(page, r, 120)
  await r.locator('.ui-row__delete').click()
  await expect(page.locator('.s-daylist .ui-row', { hasText: 'Geser saya' })).toHaveCount(0)
  await toast(page).getByRole('button', { name: 'Urungkan' }).click()
  await expect(page.locator('.s-daylist .ui-row', { hasText: 'Geser saya' })).toHaveCount(1)
  const txs = await transactions(page)
  expect(txs.map((t) => t.id)).toEqual([row.id])
})

test('AC-LS-04 · edit nominal: baris & saldo terbarui, updatedAt berubah, createdAt tetap', async ({ page }) => {
  const d = await boot(page)
  const [row] = await seedTx(page, d, [{ amount: 10000, note: 'Ubah nominal' }])
  await page.locator('.s-daylist .ui-row__content', { hasText: 'Ubah nominal' }).click()
  await keys(page, ['0'])
  await page.locator('.tx-sheet .ui-keypad__submit button').click()
  await expect(txSheet(page)).toBeHidden()
  await expect(page.locator('.s-daylist .ui-row', { hasText: 'Ubah nominal' })).toContainText('100.000')
  const [t] = await transactions(page)
  expect(t.amount).toBe(100000)
  expect(t.createdAt).toBe(row.createdAt)
  expect(t.updatedAt).toBeGreaterThan(row.updatedAt)
  await expect.poll(() => textOf(page.locator('.s-hero__value'))).toContain('100.000')
})

test('Hapus dari sheet edit (ikon tempat sampah) + Urungkan', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 9000, note: 'Hapus via sheet' }])
  await page.locator('.s-daylist .ui-row__content', { hasText: 'Hapus via sheet' }).click()
  await page.getByRole('button', { name: 'Hapus transaksi' }).click()
  await expect(txSheet(page)).toBeHidden()
  expect(await transactions(page)).toHaveLength(0)
  await toast(page).getByRole('button', { name: 'Urungkan' }).click()
  await expect.poll(async () => (await transactions(page)).length).toBe(1)
})

test('AC-LS-05 · DB kosong → state kosong + tombol Catat transaksi', async ({ page }) => {
  await boot(page)
  await expect(page.getByText('Belum ada transaksi')).toBeVisible()
  await expect(page.locator('.ui-empty, .ui-screen').getByRole('button', { name: 'Catat transaksi' }).first()).toBeVisible()
})

test('AC-LS-06 · transaksi besok di "Terjadwal", tidak memengaruhi saldo hari ini', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 50000, date: '2026-11-21', note: 'Besok' }])
  await expect(page.locator('.s-daylist section').first().locator('.ui-section__title')).toHaveText(/^Terjadwal · Sab, 21 Nov/)
  expect(await textOf(page.locator('.s-hero__value'))).toMatch(/^Rp ?0$/)
})

test('Persistensi: transaksi tetap ada setelah reload', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await keys(page, ['3', '3', '000'])
  await catCell(page, 'Kesehatan').click()
  await expect(txSheet(page)).toBeHidden()
  await page.reload()
  await expect(page.locator('.s-daylist .ui-row', { hasText: 'Kesehatan' })).toContainText('33.000')
})

test('Double-tap kategori tidak menghasilkan duplikat', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await keys(page, ['2', '000'])
  await catCell(page, 'Makan & Minum').dblclick()
  await page.waitForTimeout(600)
  expect(await transactions(page)).toHaveLength(1)
})

test('Double-tap tombol Simpan tidak menghasilkan duplikat', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await catCell(page, 'Makan & Minum').click()
  await keys(page, ['2', '000'])
  await page.locator('.tx-sheet .ui-keypad__submit button').dblclick()
  await page.waitForTimeout(600)
  expect(await transactions(page)).toHaveLength(1)
})

test('Tombol back browser menutup sheet tanpa meninggalkan app', async ({ page }) => {
  await boot(page)
  await openAdd(page)
  await page.goBack()
  await expect(txSheet(page)).toBeHidden()
  await expect(page).toHaveURL(/\/$|\/\?/)
  await expect(page.locator('.ui-screen')).toBeVisible()
})

// rp dipakai agar impor konsisten
void rp
void dumpDb
void installClock
