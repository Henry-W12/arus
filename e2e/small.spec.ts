/* Viewport kecil iPhone SE 375×667 (AC-IN-14, AC-UI-02). */
import { expect, test, type Page } from '@playwright/test'
import { boot, catCell, keys, reload, setSettingsRaw, txSheet } from './helpers'

const inViewport = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= window.innerHeight + 0.5 && r.left >= 0 && r.right <= window.innerWidth + 0.5
  })

test('AC-IN-14 · tinggi 667: grid 4×2, keypad & nominal terlihat tanpa scroll', async ({ page }) => {
  await boot(page)
  await page.locator('.ui-fab').click()
  await expect(txSheet(page)).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.locator('.tx-sheet .ui-cat-cell')).toHaveCount(8)
  for (const sel of ['.tx-sheet .ui-amount-display', '.tx-sheet .ui-keypad__grid', '.tx-sheet .ui-cat-cell:nth-child(8)', '.tx-sheet__ctx']) {
    expect(await inViewport(page, sel), sel).toBe(true)
  }
  // Simpan tampil setelah kategori dipilih (nominal 0) → tetap tanpa scroll
  await catCell(page, 'Makan & Minum').click()
  expect(await inViewport(page, '.tx-sheet .ui-keypad__submit button')).toBe(true)
  expect(await inViewport(page, '.tx-sheet .ui-keypad__grid')).toBe(true)
  await keys(page, ['1', '000'])
})

test('AC-UI-02 · teks "Lebih besar" di 375 px: tanpa scroll horizontal di layar utama', async ({ page }) => {
  await boot(page)
  await setSettingsRaw(page, { textScale: 1.24 })
  for (const path of ['/', '/ringkasan', '/anggaran', '/akun', '/pengaturan', '/?sheet=add']) {
    await reload(page, path)
    await page.waitForTimeout(300)
    const over = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed') bad.push(`${el.className}`.slice(0, 40))
      }
      return { sw: document.scrollingElement!.scrollWidth, bad: [...new Set(bad)].slice(0, 5) }
    })
    expect(over.sw, `${path} scrollWidth`).toBeLessThanOrEqual(375)
    expect(over.bad, `${path} elemen melewati tepi kanan`).toEqual([])
  }
})
