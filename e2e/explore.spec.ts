/*
 * Uji eksploratif (fase 4): nilai ekstrem, data besar & performa, aksesibilitas dasar, console, viewport,
 * serta screenshot review visual ke docs/screens/qa-*.png. Angka hasil ukur dicetak ke console ([ukur]).
 */
import { expect, test, type Page } from '@playwright/test'
import {
  boot,
  catCell,
  collectConsole,
  digits,
  keys,
  putRows,
  reload,
  seedTx,
  setOpening,
  setSettingsRaw,
  shot,
  textOf,
  transactions,
  txSheet,
  buildTx,
  type Dump,
  type TxSpec,
} from './helpers'

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
const pad = (n: number) => String(n).padStart(2, '0')
function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Data demo realistis (mirip scripts/demo-seed.ts) untuk build produksi. */
function demoSpecs(today: string, days: number, perDay = 3): TxSpec[] {
  const r = rng(7)
  const MEALS = ['Nasi padang', 'Kopi Kenangan', 'Bakso', 'Makan siang', 'Soto ayam', 'Martabak', 'Mie ayam', '']
  const out: TxSpec[] = []
  for (let i = days; i >= 0; i--) {
    const d = addDays(today, -i)
    for (let k = 0; k < 1 + Math.floor(r() * perDay); k++)
      out.push({ amount: Math.round((15000 + r() * 55000) / 500) * 500, date: d, account: r() < 0.7 ? 'Tunai' : 'E-Wallet', note: MEALS[Math.floor(r() * MEALS.length)] || undefined })
    if (r() < 0.6) out.push({ amount: Math.round((11000 + r() * 26000) / 500) * 500, date: d, account: 'E-Wallet', category: 'Transportasi', note: 'Gojek' })
    if (r() < 0.18) out.push({ amount: Math.round(120000 + r() * 320000), date: d, account: 'Rekening Bank', category: 'Belanja Harian', note: 'Indomaret' })
    if (d.endsWith('-05')) out.push({ amount: 452000, date: d, account: 'Rekening Bank', category: 'Tagihan & Utilitas', note: 'Listrik PLN' })
    if (d.endsWith('-01')) out.push({ amount: 2400000, date: d, account: 'Rekening Bank', category: 'Tempat Tinggal', note: 'Kos' })
    if (d.endsWith('-25')) out.push({ type: 'income', amount: 12500000, date: d, account: 'Rekening Bank', category: 'Gaji', note: 'Gaji' })
    if (d.endsWith('-12')) out.push({ type: 'transfer', amount: 750000, date: d, account: 'Rekening Bank', to: 'E-Wallet' })
  }
  out.push({ amount: 1250000, date: addDays(today, 6), account: 'Rekening Bank', category: 'Kesehatan', note: 'Premi asuransi' })
  return out
}

async function demo(page: Page, d: Dump, days = 125) {
  await setOpening(page, d, { Tunai: 450000, 'Rekening Bank': 4250000, 'E-Wallet': 180000 })
  const now = Date.now()
  const cat = (n: string) => d.categories.find((c) => c.name === n && c.kind === 'expense')!.id
  await putRows(page, 'budgets', [
    ['Makan & Minum', 2800000],
    ['Transportasi', 600000],
    ['Belanja Harian', 1200000],
    ['Tagihan & Utilitas', 900000],
    ['Hiburan & Langganan', 250000],
  ].map(([n, a], i) => ({ id: `b${i}`, categoryId: cat(n as string), amount: a, startPeriod: '2026-07', createdAt: now, updatedAt: now })))
  await putRows(page, 'templates', [
    { id: 't1', label: 'Kopi', type: 'expense', amount: 25000, categoryId: cat('Makan & Minum'), note: 'Kopi', sortOrder: 0, useCount: 0, createdAt: now, updatedAt: now },
    { id: 't2', label: 'Parkir', type: 'expense', amount: 5000, categoryId: cat('Transportasi'), note: 'Parkir', sortOrder: 1, useCount: 0, createdAt: now, updatedAt: now },
  ])
  const rows = buildTx(d, demoSpecs('2026-11-20', days))
  await putRows(page, 'transactions', rows as never)
  return rows
}

test('Eksplorasi · BUG-01 dengan data demo: Ringkasan vs header "Bulan ini" vs Cari "Bulan ini" vs Anggaran', async ({ page }) => {
  const d = await boot(page)
  await demo(page, d)
  await reload(page, '/')
  await expect.poll(() => textOf(page.locator('.s-hero__line'))).toMatch(/[1-9]/)
  const hero = await textOf(page.locator('.s-hero__line'))
  await reload(page, '/ringkasan')
  const summ = await textOf(page.locator('.s-stats__cell', { hasText: 'Pengeluaran' }).locator('.s-stats__value'))
  await reload(page, '/anggaran')
  const unbudgeted = await page.locator('.ui-group', { hasText: 'Kesehatan' }).count()
  console.log(`[ukur] header: ${hero} | ringkasan pengeluaran: ${summ} | Kesehatan (premi terjadwal) di "Tanpa anggaran": ${unbudgeted > 0}`)
  const heroExp = digits(hero.split('keluar')[0])
  expect(digits(summ) - heroExp, 'selisih = premi terjadwal 1.250.000 (BUG-01)').toBe(0)
})

test('Eksplorasi · nominal maksimum Rp 999.999.999.999 di semua layar', async ({ page }) => {
  const d = await boot(page)
  await setOpening(page, d, { 'Rekening Bank': -999999999999 })
  await seedTx(page, d, [{ type: 'income', amount: 999999999999, category: 'Gaji', account: 'Tunai', note: 'Gaji maksimal' }])
  await page.locator('.ui-fab').click()
  await keys(page, Array(12).fill('9'))
  await expect.poll(async () => (await page.locator('.tx-sheet .ui-amount-display').getAttribute('aria-label')) ?? '').toContain('999.999.999.999')
  await shot(page, 'input-max-amount')
  await catCell(page, 'Belanja').click()
  await expect(txSheet(page)).toBeHidden()
  await page.waitForTimeout(800)
  await shot(page, 'transactions-max-amount')
  const overflow = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.num, .ui-amount, [class*=amount], [class*=value]'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => `${el.className}: ${el.textContent}`.slice(0, 80)),
    )
  const o1 = await overflow()
  const errs = collectConsole(page)
  await reload(page, '/ringkasan')
  await page.waitForTimeout(1500)
  await shot(page, 'summary-max-amount')
  console.log('[ukur] ringkasan nominal maks: stat terlihat=', await page.locator('.s-stats').count(), 'error=', JSON.stringify(errs.filter((e) => e.type !== 'warning')))
  const o2 = await overflow()
  await reload(page, '/akun')
  await page.waitForTimeout(800)
  await shot(page, 'accounts-max-amount')
  const o3 = await overflow()
  console.log('[ukur] overflow nominal besar:', JSON.stringify({ transaksi: o1, ringkasan: o2, akun: o3 }))
  // total saldo bisa melampaui 12 digit (2 × 999 M − 999 M) — tetap harus integer aman
  expect((await transactions(page)).every((t) => Number.isSafeInteger(t.amount))).toBe(true)
})

test('Eksplorasi · catatan 120 karakter + emoji, nama kategori 24 karakter', async ({ page }) => {
  const d = await boot(page)
  const now = Date.now()
  const longName = 'Langganan Streaming Kel.' // 24
  await putRows(page, 'categories', [{ id: 'cat-long', kind: 'expense', name: longName, icon: 'film', color: 'c7', sortOrder: 0.5, archived: 0, createdAt: now, updatedAt: now }])
  await page.locator('.ui-fab').click().catch(() => {})
  await reload(page, '/?sheet=add')
  await keys(page, ['3', '5', '000'])
  await page.locator('.tx-sheet__note-chip').click()
  const note = '🍜🍜 Makan malam bersama tim proyek di warung Padang dekat kantor 😋 — total dibagi enam orang termasuk es teh manis 🧋!!'
  await page.getByPlaceholder('Mis. kopi dengan klien').fill(note + ' tambahan teks yang melebihi batas')
  const val = await page.getByPlaceholder('Mis. kopi dengan klien').inputValue()
  console.log(`[ukur] panjang catatan tersimpan di field: ${val.length} (JS length; emoji = 2 unit)`)
  await page.getByRole('button', { name: 'Selesai' }).click()
  await shot(page, 'input-long-note')
  await catCell(page, longName).click().catch(async () => {
    await catCell(page, 'Lainnya…').click()
    await page.locator('.ui-sheet.is-open').getByText(longName).click()
  })
  await expect(txSheet(page)).toBeHidden()
  await page.waitForTimeout(800)
  await shot(page, 'transactions-long-note')
  const t = (await transactions(page))[0]
  expect(t.note!.length).toBeLessThanOrEqual(120)
  // emoji tidak boleh terpotong di tengah surrogate pair
  expect(/[\uD800-\uDBFF]$/.test(t.note!)).toBe(false)
  await reload(page, '/ringkasan')
  await shot(page, 'summary-long-category')
  void d
})

test('Eksplorasi · performa 1.500+ transaksi: render, scroll, Ringkasan, Cari', async ({ page }) => {
  test.setTimeout(180_000)
  const d = await boot(page)
  const rows = await demo(page, d, 500)
  console.log(`[ukur] jumlah transaksi: ${rows.length}`)
  const t0 = Date.now()
  await reload(page, '/')
  await expect(page.locator('.s-daylist .ui-row').first()).toBeVisible()
  const tList = Date.now() - t0
  const rowCount = await page.locator('.s-daylist .ui-row').count()
  // scroll ke bawah 30× dan ukur frame terpanjang
  const scroll = await page.evaluate(async () => {
    const el = document.querySelector('.ui-screen__scroll') as HTMLElement
    let worst = 0
    let last = performance.now()
    let frames = 0
    const start = performance.now()
    await new Promise<void>((res) => {
      const step = () => {
        const now = performance.now()
        worst = Math.max(worst, now - last)
        last = now
        frames++
        el.scrollBy(0, 400)
        if (frames < 120) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
    return { worst: Math.round(worst), avg: Math.round((performance.now() - start) / frames), rows: document.querySelectorAll('.s-daylist .ui-row').length }
  })
  const t1 = Date.now()
  await reload(page, '/ringkasan')
  await expect(page.locator('.s-catrow').first()).toBeVisible()
  const tSum = Date.now() - t1
  await reload(page, '/cari')
  const t2 = Date.now()
  await page.getByLabel('Cari transaksi').fill('bakso')
  await expect(page.locator('.s-result-sum')).toBeVisible()
  const tSearch = Date.now() - t2
  console.log(`[ukur] tab Transaksi tampil ${tList} ms (${rowCount} baris DOM awal); scroll 120 frame: frame terburuk ${scroll.worst} ms, rata-rata ${scroll.avg} ms, baris DOM setelah scroll ${scroll.rows}; Ringkasan ${tSum} ms; Cari "bakso" ${tSearch} ms`)
  expect(tList).toBeLessThan(3000)
})

test('Eksplorasi · aksesibilitas dasar: nama tombol, target sentuh ≥44 px', async ({ page }) => {
  const d = await boot(page)
  await demo(page, d, 20)
  const report: Record<string, { unnamed: string[]; small: string[] }> = {}
  for (const path of ['/', '/ringkasan', '/anggaran', '/akun', '/pengaturan', '/cari', '/?sheet=add']) {
    await reload(page, path)
    await page.waitForTimeout(400)
    report[path] = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role=button], [role=radio], [role=tab], input, [role=switch], svg g[class*=col]'))
      const vis = els.filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && !e.closest('[inert]') && r.bottom > 0 && r.top < innerHeight
      })
      const name = (e: HTMLElement) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || (e as HTMLInputElement).labels?.[0]?.textContent || '').trim()
      const desc = (e: HTMLElement) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`
      return {
        unnamed: [...new Set(vis.filter((e) => !name(e) && e.tagName !== 'INPUT').map(desc))],
        small: [
          ...new Set(
            vis
              .filter((e) => e.tagName !== 'INPUT' || (e as HTMLInputElement).type !== 'checkbox')
              .filter((e) => {
                const r = e.getBoundingClientRect()
                return r.width < 43.5 || r.height < 43.5
              })
              .map((e) => {
                const r = e.getBoundingClientRect()
                return `${desc(e)} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`
              }),
          ),
        ].slice(0, 12),
      }
    })
  }
  console.log('[ukur] a11y', JSON.stringify(report))
})

test('Eksplorasi · kontras token teks (light & dark)', async ({ page }) => {
  await boot(page)
  const res: Record<string, Record<string, number>> = {}
  for (const theme of ['light', 'dark']) {
    await setSettingsRaw(page, { theme })
    await reload(page, '/')
    res[theme] = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement)
      const parse = (v: string) => {
        const c = document.createElement('canvas').getContext('2d')!
        c.fillStyle = v.trim()
        const h = c.fillStyle as string
        if (h.startsWith('#')) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
        return h.match(/\d+/g)!.slice(0, 3).map(Number)
      }
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((x) => {
          const s = x / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a: string, b: string) => {
        const [l1, l2] = [lum(parse(cs.getPropertyValue(a))), lum(parse(cs.getPropertyValue(b)))].sort((x, y) => y - x)
        return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100
      }
      return {
        'ink/bg': ratio('--ink', '--bg'),
        'ink-2/bg': ratio('--ink-2', '--bg'),
        'ink-2/surface': ratio('--ink-2', '--surface'),
        'ink-2/surface-2': ratio('--ink-2', '--surface-2'),
        'ink-3/bg': ratio('--ink-3', '--bg'),
        'ink-3/surface': ratio('--ink-3', '--surface'),
        'accent/bg': ratio('--accent', '--bg'),
        'accent/surface': ratio('--accent', '--surface'),
        'negative/surface': ratio('--negative', '--surface'),
        'warning/surface': ratio('--warning', '--surface'),
        'on-accent/accent': ratio('--on-accent', '--accent'),
      }
    })
  }
  console.log('[ukur] kontras', JSON.stringify(res))
  expect(res.light['ink-2/surface']).toBeGreaterThanOrEqual(4.5)
  expect(res.dark['ink-2/surface']).toBeGreaterThanOrEqual(4.5)
})

test('Eksplorasi · console error/warning di semua layar', async ({ page }) => {
  const logs = collectConsole(page)
  const d = await boot(page)
  await demo(page, d, 40)
  for (const path of ['/', '/cari', '/ringkasan', '/anggaran', '/akun', `/akun/${d.accounts[0].id}`, '/pengaturan', '/pengaturan/kategori', '/pengaturan/favorit', '/pengaturan/berulang', '/pengaturan/data', '/pengaturan/keamanan', '/?sheet=add', '/tidak-ada']) {
    await reload(page, path)
    await page.waitForTimeout(400)
  }
  console.log('[ukur] console', JSON.stringify(logs))
  expect(logs.filter((l) => l.type !== 'warning')).toEqual([])
})

test('Eksplorasi · landscape 844×390 & lebar 320', async ({ page }) => {
  const d = await boot(page)
  await demo(page, d, 30)
  await page.setViewportSize({ width: 844, height: 390 })
  await reload(page, '/')
  await reload(page, '/?sheet=add')
  await page.waitForTimeout(400)
  await shot(page, 'landscape-input')
  const keypadVisible = await page.locator('.tx-sheet .ui-keypad__grid').evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1)
  await page.setViewportSize({ width: 320, height: 568 })
  await reload(page, '/?sheet=add')
  await page.waitForTimeout(400)
  await page.waitForTimeout(800)
  await shot(page, 'w320-input')
  const sw = await page.evaluate(() => document.scrollingElement!.scrollWidth)
  await reload(page, '/ringkasan')
  console.log(`[ukur] landscape keypad terlihat penuh: ${keypadVisible}; scrollWidth @320: ${sw}`)
})

test('Eksplorasi · fokus keyboard: Tab dari sheet input tetap di dalam sheet, fokus kembali setelah tutup', async ({ page }) => {
  await boot(page)
  await page.locator('.ui-fab').focus()
  await page.keyboard.press('Enter')
  await expect(txSheet(page)).toBeVisible()
  const inside: boolean[] = []
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    inside.push(await page.evaluate(() => !!document.activeElement?.closest('.tx-sheet')))
  }
  await page.keyboard.press('Escape')
  await expect(txSheet(page)).toBeHidden()
  const back = await page.evaluate(() => document.activeElement?.className ?? '')
  console.log(`[ukur] fokus terperangkap di sheet: ${inside.every(Boolean)}; fokus setelah tutup: ${back}`)
  expect(inside.every(Boolean)).toBe(true)
})

test('BUG-03 · tombol back browser: sheet edit, sub-sheet tanggal, dan layar turunan', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 1000, note: 'Back test' }])
  await page.locator('.s-daylist .ui-row__content').first().click()
  await expect(txSheet(page)).toBeVisible()
  await page.locator('.tx-sheet__ctx .ui-chip', { hasText: 'Hari ini' }).click()
  await expect(page.locator('.ui-sheet.is-open')).toHaveCount(2)
  await page.goBack()
  // BUG-03: back menutup sheet induk → sub-sheet "Tanggal" ikut tertutup (tidak yatim).
  await expect(page.locator('.ui-sheet.is-open')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await page.waitForTimeout(300)
  await shot(page, 'back-orphan-datepicker')
  const afterOne = { sheets: await page.locator('.ui-sheet.is-open').evaluateAll((e) => e.map((x) => x.className)), url: page.url() }
  await page.goBack()
  await page.waitForTimeout(500)
  const afterTwo = { sheets: await page.locator('.ui-sheet.is-open').count(), url: page.url() }
  console.log(`[ukur] back #1 → ${JSON.stringify(afterOne)}; back #2 → ${JSON.stringify(afterTwo)}`)
  await reload(page, '/pengaturan')
  await page.getByText('Kategori', { exact: true }).first().click()
  await expect(page).toHaveURL(/kategori/)
  await page.goBack()
  await expect(page).toHaveURL(/\/pengaturan$/)
})

test('Review visual · screenshot layar utama (light & dark) dengan data demo', async ({ page }) => {
  test.setTimeout(180_000)
  const d = await boot(page)
  await demo(page, d)
  for (const theme of ['light', 'dark'] as const) {
    await setSettingsRaw(page, { theme })
    for (const [name, path] of [
      ['transactions', '/'],
      ['summary', '/ringkasan'],
      ['budgets', '/anggaran'],
      ['accounts', '/akun'],
      ['account-detail', `/akun/${d.accounts.find((a) => a.name === 'Rekening Bank')!.id}`],
      ['search', '/cari'],
      ['input', '/?sheet=add'],
      ['settings', '/pengaturan'],
      ['data', '/pengaturan/data'],
    ] as const) {
      await reload(page, path)
      await page.waitForTimeout(600)
      if (name === 'search') await page.getByLabel('Cari transaksi').fill('kopi')
      if (name === 'search') await page.waitForTimeout(400)
      await shot(page, `${name}-${theme}`)
    }
  }
})
