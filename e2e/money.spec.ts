/* C. Ringkasan, D. Akun & transfer, E. Anggaran, F. Periode + konsistensi antar-layar. */
import { expect, test, type Page } from '@playwright/test'
import {
  accId,
  boot,
  catId,
  digits,
  keys,
  putRows,
  reload,
  seedTx,
  setOpening,
  setSettingsRaw,
  tabTo,
  textOf,
  transactions,
  txSheet,
  type Dump,
} from './helpers'

const stat = (page: Page, label: string) => page.locator('.s-stats__cell', { hasText: label }).locator('.s-stats__value')
const heroMonth = (page: Page) => page.locator('.s-hero__line')

async function basicMonth(page: Page, d: Dump) {
  return seedTx(page, d, [
    { amount: 100000, category: 'Makan & Minum', date: '2026-11-10' },
    { amount: 50000, category: 'Transportasi', date: '2026-11-11' },
    { type: 'income', amount: 1000000, category: 'Gaji', date: '2026-11-01', account: 'Rekening Bank' },
    { type: 'transfer', amount: 200000, account: 'Rekening Bank', to: 'Tunai', date: '2026-11-12' },
  ])
}

test('AC-SM-01/02 · tiga angka, transfer tidak dihitung, donat 67/33, tap baris → /cari terfilter', async ({ page }) => {
  const d = await boot(page)
  await basicMonth(page, d)
  await reload(page, '/ringkasan')
  await expect(stat(page, 'Pengeluaran')).toHaveText(/150\.000/)
  await expect(stat(page, 'Pemasukan')).toHaveText(/1\.000\.000/)
  expect(await textOf(page.locator('.s-stats__netval'))).toContain('850.000')
  const rows = page.locator('.s-catrow')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Makan & Minum')
  await expect(rows.nth(0)).toContainText('67%')
  await expect(rows.nth(1)).toContainText('33%')
  await rows.nth(0).click()
  await expect(page).toHaveURL(new RegExp(`/cari\\?cat=${catId(d, 'Makan & Minum')}&from=2026-11-01&to=2026-11-30`))
  await expect(page.locator('.s-daylist .ui-row')).toHaveCount(1)
})

test('AC-SM-03 · >7 kategori → 6 terbesar + Lainnya', async ({ page }) => {
  const d = await boot(page)
  const cats = ['Makan & Minum', 'Transportasi', 'Belanja Harian', 'Tagihan & Utilitas', 'Tempat Tinggal', 'Belanja', 'Hiburan & Langganan', 'Kesehatan']
  await seedTx(page, d, cats.map((c, i) => ({ amount: (10 - i) * 10000, category: c, date: '2026-11-05' })))
  await reload(page, '/ringkasan')
  const label = await page.locator('.s-donut-wrap [aria-label]').first().getAttribute('aria-label')
  expect(label).toContain('Lainnya')
  // 7 segmen: 6 + Lainnya (sisa = 30rb + 20rb dari 2 terkecil)
  expect(label!.split(',').length).toBe(7)
})

test('AC-SM-04/05/06 · navigasi periode, › nonaktif, delta "—", tren 6 bar, periode kosong', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-03' },
    { amount: 50000, date: '2026-10-03' },
    { amount: 10000, date: '2026-08-03' },
  ])
  await reload(page, '/ringkasan')
  await expect(page.getByRole('button', { name: 'Periode berikutnya' })).toBeDisabled()
  // Nov 100rb vs Okt 50rb → ▲ 100%
  await expect(page.locator('.s-stats__cell', { hasText: 'Pengeluaran' }).locator('.s-delta')).toHaveText(/▲\s*100%/)
  await expect(page.locator('.s-stats__cell', { hasText: 'Pemasukan' }).locator('.s-delta')).toHaveText('—')
  await page.getByRole('button', { name: 'Periode sebelumnya' }).click()
  await expect(page.locator('.s-period__title')).toHaveText('Oktober 2026')
  await expect(stat(page, 'Pengeluaran')).toHaveText(/50\.000/)
  await page.getByRole('button', { name: 'Periode sebelumnya' }).click()
  await expect(page.locator('.s-period__title')).toHaveText('September 2026')
  await expect(page.locator('.s-donut-empty')).toHaveText('Belum ada pengeluaran di periode ini')
  await expect(page.locator('.s-trend__col')).toHaveCount(6)
  // tren berakhir di periode terpilih (Apr–Sep); tap bar Agustus → pindah
  await page.locator('.s-trend__col').nth(4).locator('rect').click()
  await expect(page.locator('.s-period__title')).toHaveText('Agustus 2026')
  // batas bawah: Agustus (transaksi pertama)
  await expect(page.getByRole('button', { name: 'Periode sebelumnya' })).toBeDisabled()
})

// BUG-01: Ringkasan & Anggaran menghitung transaksi Terjadwal (tanggal > hari ini), header "Bulan ini" tidak.
test('BUG-01 · Ringkasan "Pengeluaran" = header "Bulan ini" saat ada transaksi terjadwal', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-10' },
    { amount: 1250000, date: '2026-11-26', category: 'Kesehatan', note: 'Premi asuransi' },
  ])
  await expect.poll(() => textOf(heroMonth(page))).toContain('100.000')
  await tabTo(page, 'Ringkasan')
  await expect(stat(page, 'Pengeluaran')).toBeVisible()
  const summary = digits(await textOf(stat(page, 'Pengeluaran')))
  expect(summary, 'Ringkasan memasukkan transaksi terjadwal 26 Nov').toBe(100000)
})

test('BUG-01 · Anggaran tidak menghitung transaksi terjadwal sebagai terpakai', async ({ page }) => {
  const d = await boot(page)
  const now = Date.now()
  await putRows(page, 'budgets', [{ id: 'b1', categoryId: catId(d, 'Makan & Minum'), amount: 1000000, startPeriod: '2026-11', createdAt: now, updatedAt: now }])
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-10' },
    { amount: 400000, date: '2026-11-28', note: 'Katering terjadwal' },
  ])
  await reload(page, '/anggaran')
  expect(await textOf(page.locator('.s-brow', { hasText: 'Makan & Minum' })), 'terpakai termasuk 400rb terjadwal 28 Nov').toContain('Sisa Rp 900.000')
})

// ------------------------------------------------------------ akun

test('AC-AC-02 · transfer 200rb Tunai→Bank lewat UI: saldo berpindah, total tetap, ringkasan tidak berubah', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 500000 })
  await reload(page, '/akun')
  await expect(page.locator('.s-hero__value, .s-accounts .ui-amount').first()).toContainText('500.000')
  await page.getByRole('button', { name: 'Transfer' }).first().click()
  await expect(txSheet(page)).toBeVisible()
  await keys(page, ['2', '0', '0', '000'])
  await page.getByRole('radiogroup', { name: 'Akun dari' }).getByRole('radio', { name: 'Tunai' }).click()
  await page.getByRole('radiogroup', { name: 'Akun ke' }).getByRole('radio', { name: 'Rekening Bank' }).click()
  await page.locator('.tx-sheet .ui-keypad__submit button').click()
  await expect(txSheet(page)).toBeHidden()
  const rows = page.locator('.ui-row')
  await expect(rows.filter({ hasText: 'Tunai' }).first()).toContainText('300.000')
  await expect(rows.filter({ hasText: 'Rekening Bank' }).first()).toContainText('200.000')
  await expect(page.locator('.s-hero__value').first()).toContainText('500.000')
  const txs = await transactions(page)
  expect(txs).toHaveLength(1)
  expect(txs[0]).toMatchObject({ type: 'transfer', amount: 200000, accountId: accId(d, 'Tunai'), toAccountId: accId(d, 'Rekening Bank') })
  await reload(page, '/ringkasan')
  await expect(stat(page, 'Pengeluaran')).toHaveText(/Rp.0$/)
  await expect(stat(page, 'Pemasukan')).toHaveText(/Rp.0$/)
})

test('AC-AC-03 · Transfer Dari = Ke tidak bisa; 1 akun aktif → segmen Transfer nonaktif', async ({ page }) => {
  const d = await boot(page)
  await page.locator('.ui-fab').click()
  await page.locator('.tx-sheet__seg [role=radio]', { hasText: 'Transfer' }).click()
  await keys(page, ['1', '000'])
  const save = page.locator('.tx-sheet .ui-keypad__submit button')
  await expect(save).toBeDisabled()
  await expect(page.locator('.tx-sheet .ui-keypad__hint')).toHaveText('Pilih akun tujuan')
  // akun yang sama dengan "Dari" dinonaktifkan di strip "Ke"
  const from = await page.getByRole('radiogroup', { name: 'Akun dari' }).getByRole('radio', { checked: true }).innerText()
  await expect(page.getByRole('radiogroup', { name: 'Akun ke' }).getByRole('radio', { name: from.trim() })).toBeDisabled()
  // arsipkan dua akun → hanya 1 aktif
  await putRows(page, 'accounts', d.accounts.map((a) => (a.name === 'Tunai' ? a : { ...a, archived: 1 })))
  await reload(page, '/?sheet=add')
  await expect(page.locator('.tx-sheet__seg [role=radio]', { hasText: 'Transfer' })).toBeDisabled()
})

test('AC-AC-04 · Sesuaikan saldo 300rb → 287.500 membuat adjustment −12.500, ringkasan tidak berubah', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 300000 })
  await reload(page, `/akun/${accId(d, 'Tunai')}`)
  await page.locator('.s-tile', { hasText: 'Sesuaikan' }).click()
  const sh = page.locator('.s-amount-sheet.is-open')
  await expect(sh).toBeVisible()
  for (let i = 0; i < 6; i++) await sh.getByRole('button', { name: 'Hapus satu digit' }).click()
  for (const k of ['2', '8', '7', '5', '0', '0']) await sh.getByRole('button', { name: k, exact: true }).click()
  await expect(sh.locator('.s-amount-sheet__info')).toContainText('12.500')
  await sh.getByRole('button', { name: 'Catat penyesuaian' }).click()
  await expect(page.locator('.s-acct-hero__bal')).toContainText('287.500')
  const txs = await transactions(page)
  expect(txs).toHaveLength(1)
  expect(txs[0]).toMatchObject({ type: 'adjustment', amount: -12500, date: '2026-11-20' })
  await reload(page, '/ringkasan')
  await expect(page.getByText('Belum ada data').or(page.locator('.s-donut-empty'))).toBeVisible()
})

test('AC-AC-04b · tombol Catat penyesuaian nonaktif bila selisih 0', async ({ page }) => {
  const d = await boot(page)
  await reload(page, `/akun/${accId(d, 'Tunai')}`)
  await page.locator('.s-tile', { hasText: 'Sesuaikan' }).click()
  await expect(page.locator('.s-amount-sheet.is-open').getByRole('button', { name: 'Catat penyesuaian' })).toBeDisabled()
})

test('AC-AC-05/06 · akun bertransaksi hanya bisa diarsip; arsip hilang dari pemilih & total; nama duplikat ditolak', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { 'E-Wallet': 70000, Tunai: 30000 })
  await seedTx(page, d, [{ amount: 10000, account: 'E-Wallet' }], `/akun/${accId(d, 'E-Wallet')}`)
  await page.getByRole('button', { name: 'Ubah' }).click()
  await page.getByRole('button', { name: 'Arsipkan atau hapus akun' }).click()
  await expect(page.getByRole('button', { name: 'Arsipkan akun' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hapus akun', exact: true }).filter({ visible: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Arsipkan akun' }).click()
  await expect(page.locator('.ui-toast')).toContainText('diarsipkan')
  await reload(page, '/akun')
  await expect(page.locator('.s-hero__value').first()).toContainText('30.000')
  await reload(page, '/?sheet=add')
  await page.locator('.tx-sheet__ctx .ui-chip').first().click()
  await expect(page.locator('.s-sheet-list').last()).not.toContainText('E-Wallet')
  // riwayat tetap tampil
  await reload(page, '/')
  await expect(page.locator('.s-daylist .ui-row').first()).toContainText('E-Wallet')
  // nama duplikat
  await reload(page, '/akun')
  await page.getByRole('button', { name: 'Akun baru' }).click()
  await page.getByLabel('Nama').fill('tunai')
  await page.locator('.ui-sheet.is-open').getByRole('button', { name: /^(Simpan|Buat)/ }).first().click()
  await expect(page.getByText('Nama sudah dipakai')).toBeVisible()
})

test('AC-AC-07 · saldo berjalan di detail konsisten dengan saldo akhir', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 100000 })
  await seedTx(page, d, [
    { amount: 10000, date: '2026-11-15' },
    { type: 'income', amount: 50000, category: 'Hadiah', date: '2026-11-16' },
    { type: 'transfer', amount: 20000, account: 'Tunai', to: 'Rekening Bank', date: '2026-11-17' },
    { type: 'transfer', amount: 5000, account: 'Rekening Bank', to: 'Tunai', date: '2026-11-18' },
  ], `/akun/${accId(d, 'Tunai')}`)
  await expect(page.locator('.s-acct-hero__bal')).toContainText('125.000')
  await expect(page.locator('.ui-row__trail-sub').first()).toContainText('125.000')
})

test('AC-AC-07b · detail akun dengan transaksi terjadwal: saldo berjalan baris teratas vs saldo hero', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 100000 })
  await seedTx(page, d, [
    { amount: 10000, date: '2026-11-15' },
    { amount: 40000, date: '2026-11-25', note: 'Terjadwal' },
  ], `/akun/${accId(d, 'Tunai')}`)
  await expect(page.locator('.s-acct-hero__bal')).toContainText('90.000')
  await expect(page.getByText(/Saldo setelah terjadwal/)).toContainText('50.000')
})

test('AC-AC-08 · includeInTotal=0 tampil tapi tidak dijumlah', async ({ page }) => {
  const d = await boot(page)
  await putRows(page, 'accounts', d.accounts.map((a) => (a.name === 'Rekening Bank' ? { ...a, openingBalance: 900000, includeInTotal: 0 } : a.name === 'Tunai' ? { ...a, openingBalance: 100000 } : a)))
  await reload(page, '/akun')
  await expect(page.locator('.s-hero__value').first()).toContainText('100.000')
  await expect(page.locator('.ui-row', { hasText: 'Rekening Bank' }).first()).toContainText('900.000')
})

// ------------------------------------------------------------ anggaran

async function budgetSetup(page: Page, d: Dump, spent: number) {
  const now = Date.now()
  await putRows(page, 'budgets', [{ id: 'b-makan', categoryId: catId(d, 'Makan & Minum'), amount: 1000000, startPeriod: '2026-11', createdAt: now, updatedAt: now }])
  await seedTx(page, d, [
    { amount: spent, date: '2026-11-05' },
    { type: 'transfer', amount: 300000, account: 'Rekening Bank', to: 'Tunai', date: '2026-11-06' },
    { type: 'income', amount: 700000, date: '2026-11-07' },
    { amount: 45000, category: 'Transportasi', date: '2026-11-07' },
  ], '/anggaran')
}

test('AC-BG-01/03/06/07 · 85% warning, Sisa 150rb, ≈13.000/hari, Tanpa anggaran, transfer/income diabaikan', async ({ page }) => {
  const d = await boot(page)
  await budgetSetup(page, d, 850000)
  const row = page.locator('.s-brow', { hasText: 'Makan & Minum' })
  expect(await textOf(row)).toContain('Sisa Rp 150.000')
  expect(await textOf(row)).toContain('Rp 850.000 / Rp 1.000.000')
  await expect(row.locator('.ui-progress, [class*=progress]').first()).toHaveClass(/warning/)
  expect(await textOf(page.locator('.s-budget-total__day'))).toContain('Rp 13.000/hari untuk 11 hari lagi')
  await expect(page.locator('.ui-group', { hasText: 'Transportasi' })).toContainText('45.000')
})

test('AC-BG-02 · 1,12jt → "Lebih Rp 120.000" status negative', async ({ page }) => {
  const d = await boot(page)
  await budgetSetup(page, d, 1120000)
  const row = page.locator('.s-brow', { hasText: 'Makan & Minum' })
  expect(await textOf(row)).toContain('Lebih Rp 120.000')
  await expect(row.locator('.s-brow__left')).toHaveClass(/is-over/)
})

test('AC-BG-04/05 · ubah anggaran di Nov tidak mengubah Okt; hapus di Nov tidak mengubah Okt', async ({ page }) => {
  const d = await boot(page)
  const now = Date.now()
  await putRows(page, 'budgets', [{ id: 'b-okt', categoryId: catId(d, 'Makan & Minum'), amount: 1000000, startPeriod: '2026-10', createdAt: now, updatedAt: now }])
  await seedTx(page, d, [{ amount: 1000, date: '2026-10-02' }, { amount: 1000, date: '2026-11-02' }], '/anggaran')
  await page.locator('.s-brow', { hasText: 'Makan & Minum' }).click()
  const sh = page.locator('.s-amount-sheet.is-open')
  for (let i = 0; i < 7; i++) await sh.getByRole('button', { name: 'Hapus satu digit' }).click()
  for (const k of ['1', '5', '0', '0', '0', '0', '0']) await sh.getByRole('button', { name: k, exact: true }).click()
  await sh.getByRole('button', { name: 'Simpan' }).click()
  await expect(page.locator('.s-brow', { hasText: 'Makan & Minum' })).toContainText('1.500.000')
  await page.getByRole('button', { name: 'Periode sebelumnya' }).click()
  await expect(page.locator('.s-brow', { hasText: 'Makan & Minum' })).toContainText('1.000.000')
  await page.getByRole('button', { name: 'Periode berikutnya' }).click()
  await page.locator('.s-brow', { hasText: 'Makan & Minum' }).click()
  await page.getByRole('button', { name: 'Hapus anggaran' }).click()
  await expect(page.locator('.s-brow', { hasText: 'Makan & Minum' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Periode sebelumnya' }).click()
  await expect(page.locator('.s-brow', { hasText: 'Makan & Minum' })).toContainText('1.000.000')
  const budgets = (await (await import('./helpers')).dumpDb(page)).budgets
  expect(budgets.find((b) => b.startPeriod === '2026-11')?.amount).toBe(0)
})

// ------------------------------------------------------------ periode

test('AC-PR-02/04/05 · awal periode 25: Ringkasan berlabel Desember (25 Nov–24 Des) & pemilih hanya 1–28', async ({ page }) => {
  const d = await boot(page, { time: new Date('2026-11-26T10:00:00+07:00') })
  await seedTx(page, d, [
    { amount: 11000, date: '2026-11-24' },
    { amount: 22000, date: '2026-11-25' },
  ])
  await reload(page, '/pengaturan')
  await page.getByText('Awal periode bulanan').click()
  const sheetList = page.locator('.ui-sheet.is-open')
  await expect(sheetList).toBeVisible()
  const text = await sheetList.innerText()
  expect(text).toContain('28')
  expect(text).not.toMatch(/\b29\b|\b30\b|\b31\b/)
  await setSettingsRaw(page, { periodStartDay: 25 })
  await reload(page, '/ringkasan')
  await expect(page.locator('.s-period__title')).toHaveText('Desember 2026')
  await expect(page.locator('.s-period__range')).toContainText('25 Nov')
  await expect(stat(page, 'Pengeluaran')).toHaveText(/22\.000/)
  await page.getByRole('button', { name: 'Periode sebelumnya' }).click()
  await expect(page.locator('.s-period__title')).toHaveText('November 2026')
  await expect(stat(page, 'Pengeluaran')).toHaveText(/11\.000/)
  // data tidak berubah
  expect((await transactions(page)).map((t) => t.date).sort()).toEqual(['2026-11-24', '2026-11-25'])
})

test('Konsistensi: total saldo Transaksi = total saldo Akun = Σ saldo akun', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 450000, 'Rekening Bank': 4250000 })
  await seedTx(page, d, [
    { amount: 25000 },
    { type: 'income', amount: 1000000, account: 'Rekening Bank' },
    { type: 'transfer', amount: 300000, account: 'Rekening Bank', to: 'E-Wallet' },
    { amount: 999000, date: '2026-11-29', account: 'Rekening Bank', note: 'Terjadwal' },
  ])
  await expect.poll(async () => digits(await textOf(page.locator('.s-hero__value')))).toBeGreaterThan(0)
  const t1 = digits(await textOf(page.locator('.s-hero__value')))
  await reload(page, '/akun')
  await expect.poll(async () => digits(await textOf(page.locator('.s-hero__value').first()))).toBeGreaterThan(0)
  const t2 = digits(await textOf(page.locator('.s-hero__value').first()))
  const rows = await page.locator('.s-accounts .ui-row .ui-row__trail-main, .ui-group .ui-row__trail-main').allInnerTexts()
  expect(t1).toBe(450000 - 25000 + 4250000 + 1000000)
  expect(t2).toBe(t1)
  expect(rows.length).toBeGreaterThanOrEqual(3)
})

// BUG-05: deltaRatio membagi dengan nilai sebelumnya yang negatif → arah/warna delta Selisih terbalik.
test('BUG-05 · delta Selisih: defisit mengecil (−200rb → −100rb) harus tampil sebagai perbaikan', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 200000, date: '2026-10-10' },
    { amount: 100000, date: '2026-11-10' },
  ], '/ringkasan')
  const delta = page.locator('.s-stats__netval .s-delta')
  await expect(delta).toBeVisible()
  console.log('[ukur] delta selisih:', await delta.innerText(), await delta.getAttribute('class'))
  await expect(delta).toHaveClass(/is-good/)
})

// BUG-08: selama data dimuat header tidak boleh pernah menampilkan "Rp 0" palsu (saldo sebenarnya 1.500.000).
test('BUG-08 · header Total saldo tidak berkedip "Rp 0" saat memuat', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { Tunai: 1_500_000 })
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __heroSeen: string[] }).__heroSeen = seen
    const check = () => {
      const v = document.querySelector('.s-hero__value')
      if (!v) return
      const hero = v.closest('.s-hero')
      if (hero?.classList.contains('is-loading') || getComputedStyle(v).visibility === 'hidden') return
      seen.push(v.textContent ?? '')
    }
    // Sampel tiap frame (yang benar-benar dilihat pengguna) + tiap mutasi DOM.
    new MutationObserver(check).observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
    const frame = () => {
      check()
      if (seen.length < 5) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  await reload(page, '/')
  await expect(page.locator('.s-hero__value')).toContainText('1.500.000')
  const seen = await page.evaluate(() => (window as unknown as { __heroSeen: string[] }).__heroSeen)
  expect(seen.length).toBeGreaterThan(0)
  expect(seen.filter((t) => !t.includes('1.500.000'))).toEqual([])
})
