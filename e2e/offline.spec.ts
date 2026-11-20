/* AC-PW-01 · offline setelah SW aktif (Chromium: WebKit Playwright di Windows tidak menjalankan SW). */
import { expect, test } from '@playwright/test'
import { catCell, keys, transactions, txSheet, waitReady } from './helpers'

test('AC-PW-01 · setelah kunjungan pertama, offline + reload → app terbuka & bisa mencatat', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Mulai mencatat' })).toBeVisible({ timeout: 15_000 })
  const ready = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 10_000))])
    return !!reg
  })
  expect(ready, 'service worker terdaftar & aktif').toBe(true)
  await page.getByRole('button', { name: 'Mulai mencatat' }).click()
  await keys(page, ['1', '2', '000'])
  await catCell(page, 'Makan & Minum').click()
  await expect(txSheet(page)).toBeHidden()

  await context.setOffline(true)
  await page.reload()
  await waitReady(page)
  await expect(page.locator('.ui-screen, .ui-sheet').first()).toBeVisible()
  // deep link juga dilayani navigateFallback
  await page.goto('/ringkasan')
  await waitReady(page)
  await expect(page.locator('.ui-screen')).toBeVisible()
  await page.goto('/?add=1')
  await expect(txSheet(page)).toBeVisible()
  await keys(page, ['8', '000'])
  await catCell(page, 'Transportasi').click()
  await expect(txSheet(page)).toBeHidden()
  expect((await transactions(page)).map((t) => t.amount).sort()).toEqual([12000, 8000].sort())
  await context.setOffline(false)
})
