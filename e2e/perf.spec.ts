/*
 * Ukuran waktu (project `perf`). Project ini bergantung pada semua project lain sehingga baru berjalan
 * setelah semuanya selesai — sendirian, tanpa worker paralel yang berebut CPU (dulu AC-IN-01 flaky
 * > 1,5 dtk saat 2 worker berjalan). Target tidak dilonggarkan. Angka = WebKit desktop, bukan iPhone.
 */
import { expect, test } from '@playwright/test'
import { boot, setSettingsRaw, txSheet } from './helpers'

test('AC-IN-01 · cold start openToAdd=true → sheet input terlihat ≤ 1,5 dtk', async ({ page }) => {
  const d = await boot(page)
  const bank = d.accounts.find((a) => a.name === 'Rekening Bank')!.id
  await setSettingsRaw(page, { openToAdd: true, lastAccountId: bank })
  // Satu putaran pemanasan (cache HTTP/kompilasi JS = kondisi app terpasang), lalu median 3 cold start.
  await page.goto('/')
  await expect(txSheet(page)).toBeVisible()
  const runs: number[] = []
  for (let i = 0; i < 3; i++) {
    await page.goto('about:blank')
    const t0 = Date.now()
    await page.goto('/')
    await expect(txSheet(page)).toBeVisible()
    runs.push(Date.now() - t0)
  }
  runs.sort((a, b) => a - b)
  console.log(`[ukur] AC-IN-01 goto → sheet terlihat: ${runs.join(' / ')} ms (median ${runs[1]})`)
  expect(runs[1], `median ${runs[1]} ms`).toBeLessThanOrEqual(1500)
  expect(runs[2], `terburuk ${runs[2]} ms`).toBeLessThanOrEqual(1500)
  await expect(page.locator('.tx-sheet__ctx')).toContainText('Rekening Bank')
})
