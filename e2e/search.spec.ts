/* H. Cari & filter (AC-SR-*). */
import { expect, test, type Page } from '@playwright/test'
import { accId, boot, catId, reload, seedTx, textOf, type Dump } from './helpers'

const results = (page: Page) => page.locator('.s-daylist .ui-row')
const search = (page: Page) => page.getByRole('searchbox').or(page.getByLabel('Cari transaksi')).first()

async function data(page: Page, d: Dump) {
  await seedTx(page, d, [
    { amount: 25000, note: 'Kopi Kenangan', date: '2026-11-18' },
    { amount: 30000, note: 'KOPI', date: '2026-11-17' },
    { amount: 25000, note: 'Teh botol', date: '2026-11-16', category: 'Belanja Harian' },
    { amount: 48000, note: 'Ngopi di café', date: '2026-11-15' },
    { amount: 25500, note: 'Bukan 25rb', date: '2026-11-15' },
    { amount: 100000, note: 'Makan Okt', date: '2026-10-10' },
    { amount: 500000, note: 'Ojek Okt', date: '2026-10-11', category: 'Transportasi' },
    { amount: 99999, note: 'Belanja Okt', date: '2026-10-12', category: 'Belanja' },
    { amount: 500001, note: 'Batas atas+1', date: '2026-10-13', category: 'Belanja' },
    { type: 'transfer', amount: 200000, account: 'Tunai', to: 'Rekening Bank', date: '2026-11-14' },
    { type: 'transfer', amount: 300000, account: 'Rekening Bank', to: 'E-Wallet', date: '2026-11-13' },
    { type: 'income', amount: 1000000, account: 'Rekening Bank', date: '2026-11-01' },
  ], '/cari')
}

test('AC-SR-01 · "kopi" case-insensitive, "cafe" cocok "café"', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await expect(search(page)).toBeFocused()
  await search(page).fill('kopi')
  await expect(results(page)).toHaveCount(2) // Kopi Kenangan, KOPI
  await search(page).fill('cafe')
  await expect(results(page)).toHaveCount(1)
  await expect(results(page).first()).toContainText('café')
})

test('AC-SR-02 · "25rb" hanya amount 25000', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await search(page).fill('25rb')
  await expect(results(page)).toHaveCount(2)
  await expect(page.locator('.s-result-sum')).toContainText('2 transaksi')
})

test('AC-SR-03 · Kategori (Makan, Transportasi) + Bulan lalu → hanya yang memenuhi semua; ringkasan jumlah & total', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await page.locator('.s-filters .ui-chip', { hasText: 'Kategori' }).click()
  const sh = page.locator('.ui-sheet.is-open')
  await sh.getByText('Makan & Minum', { exact: true }).click()
  await sh.getByText('Transportasi', { exact: true }).click()
  await sh.getByRole('button', { name: 'Selesai' }).click()
  await page.locator('.s-filters .ui-chip', { hasText: 'Tanggal' }).click()
  await page.locator('.ui-sheet.is-open').getByText('Bulan lalu', { exact: true }).click()
  await expect(results(page)).toHaveCount(2)
  expect(await textOf(page.locator('.s-result-sum'))).toContain('2 transaksi · -Rp 600.000')
})

test('AC-SR-04 · filter Akun = Rekening Bank mencakup transfer dari/ke', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await page.locator('.s-filters .ui-chip', { hasText: 'Akun' }).click()
  const sh = page.locator('.ui-sheet.is-open')
  await sh.getByText('Rekening Bank', { exact: true }).click()
  await sh.getByRole('button', { name: 'Selesai' }).click()
  await expect(results(page)).toHaveCount(3) // 2 transfer + gaji
  void accId
})

test('AC-SR-05 · nominal min 100rb maks 500rb inklusif', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await page.locator('.s-filters .ui-chip', { hasText: 'Nominal' }).click()
  await page.getByLabel('Minimal').fill('100rb')
  await page.getByLabel('Maksimal').fill('500rb')
  await page.getByRole('button', { name: 'Terapkan' }).click()
  // 100.000, 500.000, 200.000 (transfer), 300.000 (transfer)
  await expect(results(page)).toHaveCount(4)
  await expect(page.locator('.s-daylist')).not.toContainText('Batas atas+1')
  await expect(page.locator('.s-daylist')).not.toContainText('Belanja Okt')
})

test('AC-SR-06 · tanpa hasil → "Tidak ada yang cocok" + Reset filter', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await search(page).fill('zzzzqqq')
  await expect(page.getByText('Tidak ada yang cocok')).toBeVisible()
  await page.getByRole('button', { name: 'Reset filter' }).click()
  await expect(search(page)).toHaveValue('')
})

test('Cari dari Ringkasan: chip kategori & tanggal terisi', async ({ page }) => {
  const d = await boot(page)
  await data(page, d)
  await reload(page, `/cari?cat=${catId(d, 'Makan & Minum')}&from=2026-11-01&to=2026-11-30`)
  await expect(page.locator('.s-filters .ui-chip', { hasText: 'Makan & Minum' })).toBeVisible()
  await expect(results(page)).toHaveCount(4)
})
