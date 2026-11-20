/* Sisa AC yang bisa diotomasi: AC-SM-02 (tap donat), AC-CT-02, AC-PW-02/04, AC-UI-04/05. */
import { expect, test } from '@playwright/test'
import { boot, catCell, dumpDb, reload, seedTx, setSettingsRaw } from './helpers'

test('AC-SM-02 · tap segmen donat → teks tengah nama + % dan baris ter-highlight', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-10' },
    { amount: 50000, category: 'Transportasi', date: '2026-11-11' },
  ], '/ringkasan')
  const pt = await page.locator('.s-donut-wrap path.ui-donut__seg').nth(1).evaluate((el) => {
    const p = el as SVGPathElement
    const m = p.getPointAtLength(p.getTotalLength() / 2)
    const ctm = p.getScreenCTM()!
    return { x: m.x * ctm.a + ctm.e, y: m.y * ctm.d + ctm.f }
  })
  await page.mouse.click(pt.x, pt.y)
  await expect(page.locator('.s-donut-wrap')).toContainText(/(Makan & Minum · 67%|Transportasi · 33%)/)
  await expect(page.locator('.s-catrow.is-selected')).toHaveCount(1)
})

test('AC-CT-02 · ubah urutan kategori (keyboard panah) → urutan grid input ikut', async ({ page }) => {
  await boot(page)
  await reload(page, '/pengaturan/kategori')
  await page.getByRole('button', { name: 'Urutkan' }).click()
  const handle = page.getByRole('button', { name: /Geser untuk mengubah urutan/ }).nth(1) // Transportasi
  await handle.focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(500)
  const titles = await page.locator('.s-reorder .ui-row__title').allInnerTexts()
  console.log('[ukur] urutan setelah ArrowUp:', titles.slice(0, 3).join(' | '))
  await page.getByRole('button', { name: 'Selesai' }).click()
  await reload(page, '/?sheet=add')
  const first = await page.locator('.tx-sheet .ui-cat-cell__label').first().innerText()
  expect(first).toBe('Transportasi')
  void catCell
})

test('AC-PW-04 · dibuka di tab browser → banner pasang; bisa ditutup', async ({ page }) => {
  await boot(page, { settings: { installHintDismissedAt: null } })
  const b = page.locator('.s-banner', { hasText: 'Pasang Arus ke Home Screen' })
  await expect(b).toBeVisible()
  await b.getByRole('button', { name: 'Tutup' }).click()
  await expect(b).toHaveCount(0)
  await reload(page)
  await expect(page.locator('.s-banner', { hasText: 'Pasang Arus' })).toHaveCount(0)
})

test('AC-PW-02 · status penyimpanan permanen & pemakaian tampil di Data & Backup', async ({ page }) => {
  await boot(page)
  await reload(page, '/pengaturan/data')
  await expect(page.locator('.ui-row', { hasText: /^Penyimpanan permanen/ })).toContainText(/Aktif|Tidak aktif/)
  await expect(page.locator('.ui-row', { hasText: 'Terpakai' })).toContainText(/B/)
  const persisted = (await dumpDb(page)).settings.find((s) => s.key === 'persistGranted')
  expect(persisted, 'storage.persist() dipanggil & hasilnya disimpan').toBeTruthy()
})

test('AC-UI-04 · prefers-reduced-motion → sheet tanpa animasi transform', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await boot(page)
  await page.locator('.ui-fab').click()
  await expect(page.locator('.ui-sheet.is-open')).toHaveClass(/is-reduced/)
  const tr = await page.locator('.ui-sheet.is-open .ui-sheet__panel').evaluate((el) => getComputedStyle(el).transitionProperty + ' ' + getComputedStyle(el).transitionDuration)
  console.log('[ukur] reduced-motion panel transition:', tr)
  expect(tr).not.toMatch(/transform/)
})

test('AC-UI-05 · nominal memakai tabular-nums', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 111111 }, { amount: 888888 }])
  await expect(page.locator('.ui-row__trail-main')).toHaveCount(2)
  const vals = await page.locator('.ui-row__trail-main .ui-amount, .s-hero__value').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontVariantNumeric))
  expect(vals.length).toBeGreaterThan(1)
  console.log('[ukur] font-variant-numeric', JSON.stringify(vals))
  for (const v of vals) expect(v).toContain('tabular-nums')
  await setSettingsRaw(page, {})
})
