/* Onboarding, M. PIN, L. tema, I. kategori & favorit. */
import { expect, test, type Page } from '@playwright/test'
import { boot, catCell, catId, dumpDb, getSetting, installClock, putRows, reload, seedTx, setSettingsRaw, txSheet, waitReady } from './helpers'

async function pinKeys(page: Page, pin: string) {
  const pad = page.getByRole('group', { name: 'Keypad nominal' }).last()
  for (const k of pin) await pad.getByRole('button', { name: k, exact: true }).click()
}

test('Onboarding pertama kali → "Mulai mencatat" membuka sheet input; seed 3 akun & 18 kategori', async ({ page }) => {
  await installClock(page)
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Arus' })).toBeVisible()
  await page.getByRole('button', { name: 'Mulai mencatat' }).click()
  await expect(txSheet(page)).toBeVisible()
  const d = await dumpDb(page)
  expect(d.accounts.map((a) => a.name)).toEqual(expect.arrayContaining(['Tunai', 'Rekening Bank', 'E-Wallet']))
  expect(d.categories).toHaveLength(18)
  // kunjungan berikutnya: tidak ada onboarding, openToAdd default → sheet input langsung
  await page.reload()
  await waitReady(page)
  await expect(page.getByRole('button', { name: 'Mulai mencatat' })).toHaveCount(0)
  await expect(txSheet(page)).toBeVisible()
})

test('AC-PN-01/04 · atur PIN 2× → cold start terkunci, konten tidak di DOM; settings hanya hash+salt; disclaimer', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 77777, note: 'Rahasia' }], '/pengaturan/keamanan')
  await expect(page.getByText(/kunci tampilan|hanya mengunci tampilan/i)).toBeVisible()
  await expect(page.getByText(/tidak dienkripsi/)).toBeVisible()
  await page.getByRole('button', { name: /Atur PIN|Aktifkan PIN/ }).click()
  await pinKeys(page, '135790')
  await pinKeys(page, '135790')
  await expect(page.locator('.ui-toast')).toContainText('PIN aktif')
  const pin = (await getSetting(page, 'pin')) as Record<string, unknown>
  expect(Object.keys(pin).sort()).toEqual(['hash', 'iterations', 'salt'])
  expect(JSON.stringify(pin)).not.toContain('135790')
  await page.reload()
  await expect(page.getByText('Masukkan PIN')).toBeVisible()
  expect(await page.content()).not.toContain('Rahasia')
  await expect(page.locator('.ui-tabbar')).toHaveCount(0)
  await pinKeys(page, '135790')
  await expect(page.locator('.ui-screen')).toBeVisible()
  await expect(page.getByText('Kunci PIN').first()).toBeVisible()
})

test('AC-PN-03 · salah 5× → nonaktif 30 dtk, reload tidak mereset', async ({ page }) => {
  await boot(page)
  const { hashPin } = { hashPin: null }
  void hashPin
  // set PIN lewat UI
  await reload(page, '/pengaturan/keamanan')
  await page.getByRole('button', { name: /Atur PIN|Aktifkan PIN/ }).click()
  await pinKeys(page, '111111')
  await pinKeys(page, '111111')
  await expect(page.locator('.ui-toast')).toContainText('PIN aktif')
  await page.reload()
  for (let i = 0; i < 5; i++) {
    await pinKeys(page, '222222')
    await page.waitForTimeout(250)
  }
  await expect(page.getByText(/Terlalu banyak percobaan/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Terlalu banyak percobaan/)).toBeVisible()
  const st = (await getSetting(page, 'pinLockState')) as { failures: number; lockedUntil: number }
  expect(st.failures).toBe(5)
  await page.clock.fastForward('00:31')
  await expect(page.getByText(/Terlalu banyak percobaan/)).toHaveCount(0)
  await pinKeys(page, '111111')
  await expect(page.locator('.ui-screen')).toBeVisible()
})

test('AC-PN-02 · autoLock 1 menit: background 30 dtk tidak terkunci, 70 dtk terkunci', async ({ page }) => {
  await boot(page)
  await reload(page, '/pengaturan/keamanan')
  await page.getByRole('button', { name: /Atur PIN|Aktifkan PIN/ }).click()
  await pinKeys(page, '123123')
  await pinKeys(page, '123123')
  await expect(page.locator('.ui-toast')).toContainText('PIN aktif')
  const setVis = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { value: s, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }, state)
  await setVis('hidden')
  await expect(page.locator('.s-boot')).toBeVisible() // layar kosong untuk app switcher
  await page.clock.fastForward('00:30')
  await setVis('visible')
  await expect(page.getByText('Masukkan PIN')).toHaveCount(0)
  await setVis('hidden')
  await page.clock.fastForward('01:10')
  await setVis('visible')
  await expect(page.getByText('Masukkan PIN')).toBeVisible()
})

test('AC-PN-05 · Lupa PIN → ketik HAPUS → kembali ke seed tanpa PIN', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 5000 }])
  await setSettingsRaw(page, { pin: { hash: 'x', salt: 'y', iterations: 150000 } })
  await page.reload()
  await page.getByRole('button', { name: 'Lupa PIN?' }).click()
  await page.locator('.ui-sheet.is-open').getByRole('textbox').fill('HAPUS')
  await page.locator('.ui-sheet.is-open').getByRole('button', { name: 'Hapus semua data' }).click()
  await expect(page.locator('.ui-screen')).toBeVisible()
  const db = await dumpDb(page)
  expect(db.transactions).toHaveLength(0)
  expect(db.settings.find((s) => s.key === 'pin')?.value ?? null).toBeNull()
  expect(db.categories).toHaveLength(18)
})

// ------------------------------------------------------------ tema

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('AC-UI-01 · tema Sistem mengikuti prefers-color-scheme live; Terang/Gelap memaksa', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await boot(page)
  await reload(page, '/pengaturan')
  expect(await bg(page)).toBe('rgb(245, 244, 240)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => bg(page)).toBe('rgb(11, 12, 13)')
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Terang' }).click()
  await expect.poll(() => bg(page)).toBe('rgb(245, 244, 240)')
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Gelap' }).click()
  await expect.poll(() => bg(page)).toBe('rgb(11, 12, 13)')
  await page.reload()
  await expect.poll(() => bg(page)).toBe('rgb(11, 12, 13)')
  expect(await getSetting(page, 'theme')).toBe('dark')
})

test('AC-UI-02 · ukuran teks Lebih besar memperbesar font root', async ({ page }) => {
  await boot(page)
  await reload(page, '/pengaturan')
  const fs = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  const base = await fs()
  await page.getByRole('radiogroup', { name: 'Ukuran teks' }).getByRole('radio').last().click()
  await expect.poll(fs).toBeGreaterThan(base * 1.2)
})

// ------------------------------------------------------------ kategori & favorit

test('AC-CT-01/04 · tambah kategori "Kopi" → ada di input (via Lainnya…); ganti nama → transaksi lama ikut', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 9000, category: 'Belanja' }], '/pengaturan/kategori')
  await page.getByText('Kategori baru', { exact: true }).click()
  await page.getByLabel('Nama').fill('Kopi')
  await page.getByRole('radiogroup', { name: 'Ikon' }).getByRole('radio', { name: 'coffee' }).click()
  await page.locator('.ui-sheet.is-open').getByRole('button', { name: 'Simpan' }).click()
  await expect(page.locator('.ui-row', { hasText: 'Kopi' })).toBeVisible()
  await reload(page, '/?sheet=add')
  await catCell(page, 'Lainnya…').click()
  await expect(page.locator('.ui-sheet.is-open').getByText('Kopi', { exact: true })).toBeVisible()
  // rename Belanja → Belanja Online
  await reload(page, '/pengaturan/kategori')
  await page.locator('.ui-row__content', { hasText: /^Belanja$/ }).click()
  await page.getByLabel('Nama').fill('Belanja Online')
  await page.locator('.ui-sheet.is-open').getByRole('button', { name: 'Simpan' }).click()
  await expect(page.locator('.ui-row', { hasText: 'Belanja Online' })).toBeVisible() // tunggu tersimpan sebelum reload
  await reload(page, '/')
  await expect(page.locator('.s-daylist .ui-row').first()).toContainText('Belanja Online')
})

test('AC-CT-03 · kategori bertransaksi hanya bisa diarsipkan; hilang dari grid, tetap di riwayat; pulihkan', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 9000, category: 'Transportasi' }], '/pengaturan/kategori')
  await page.locator('.ui-row__content', { hasText: 'Transportasi' }).click()
  await page.getByRole('button', { name: 'Arsipkan atau hapus' }).click()
  await expect(page.getByRole('button', { name: 'Hapus kategori', exact: true }).filter({ visible: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Arsipkan', exact: true }).click()
  await reload(page, '/?sheet=add')
  await expect(catCell(page, 'Transportasi')).toHaveCount(0)
  await reload(page, '/')
  await expect(page.locator('.s-daylist .ui-row').first()).toContainText('Transportasi')
  await reload(page, '/pengaturan/kategori')
  await page.locator('.ui-row__content', { hasText: 'Transportasi' }).click()
  await reload(page, '/?sheet=add')
  await expect(catCell(page, 'Transportasi')).toHaveCount(1)
  void catId
})

test('Nama kategori duplikat ditolak; nama dibatasi 24 karakter', async ({ page }) => {
  await boot(page)
  await reload(page, '/pengaturan/kategori')
  await page.getByText('Kategori baru', { exact: true }).click()
  await page.getByLabel('Nama').fill('makan & minum')
  await page.locator('.ui-sheet.is-open').getByRole('button', { name: 'Simpan' }).click()
  await expect(page.locator('.ui-sheet.is-open')).toContainText(/sudah dipakai/i)
  await page.getByLabel('Nama').fill('Kategori dengan nama yang sangat panjang sekali')
  expect((await page.getByLabel('Nama').inputValue()).length).toBe(24)
})

test('AC-CT-05 · maksimal 12 favorit, tombol tambah nonaktif pada ke-12', async ({ page }) => {
  const d = await boot(page)
  const now = Date.now()
  await putRows(page, 'templates', Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `Fav ${i}`, type: 'expense', amount: 1000 * (i + 1), categoryId: catId(d, 'Makan & Minum'), sortOrder: i, useCount: 0, createdAt: now, updatedAt: now })))
  await reload(page, '/pengaturan/favorit')
  await expect(page.getByText('12 dari 12')).toBeVisible()
  const add = page.getByText('Maksimal 12 favorit')
  await expect(add).toBeVisible()
  await add.click()
  await expect(page.locator('.ui-sheet.is-open')).toHaveCount(0)
})
