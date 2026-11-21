/* Sisa AC yang bisa diotomasi: AC-SM-02 (tap donat), AC-CT-02, AC-PW-02/04, AC-UI-04/05. */
import { expect, test } from '@playwright/test'
import { boot, catCell, dumpDb, putRows, reload, seedTx, setSettingsRaw } from './helpers'

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

/*
 * AC-UI-03 / BUG-06 · target sentuh ≥ 44×44 pt. Diukur dengan hit-test sungguhan (elementFromPoint)
 * di tepi kotak 44×44 yang berpusat di tengah elemen, sehingga area sentuh yang diperluas lewat
 * pseudo-element dihitung, tetapi yang terpotong overflow/tertutup elemen lain tidak.
 */
test('AC-UI-03 · semua target sentuh ≥ 44×44 di layar utama, Cari, Pengaturan, dan sheet input', async ({ page }) => {
  test.setTimeout(120_000)
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-10', note: 'Kopi' },
    { amount: 50000, category: 'Transportasi', date: '2026-11-11' },
    { type: 'income', amount: 1000000, category: 'Gaji', date: '2026-11-01' },
    { type: 'transfer', amount: 20000, account: 'Rekening Bank', to: 'Tunai', date: '2026-11-12' },
  ])
  const acc = d.accounts.find((a) => a.name === 'Tunai')!.id
  const paths = [
    '/', '/ringkasan', '/anggaran', '/akun', `/akun/${acc}`, '/cari', '/cari?q=kopi',
    '/pengaturan', '/pengaturan/kategori', '/pengaturan/favorit', '/pengaturan/berulang', '/pengaturan/data', '/pengaturan/keamanan',
    '/?sheet=add',
  ]
  const bad: Record<string, string[]> = {}
  for (const path of paths) {
    await reload(page, path)
    await page.waitForFunction(() => (document.querySelector('.ui-screen, .tx-sheet')?.textContent ?? '').length > 60)
    if (path.includes('sheet=')) await expect(page.locator('.ui-sheet.is-open')).toBeVisible()
    await page.waitForTimeout(400)
    const small = await page.evaluate(() => {
      const sel = 'button, a[href], [role=button], [role=radio], [role=tab], [role=switch], input:not([type=hidden]), select'
      const out: string[] = []
      for (const e of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        if (e.closest('[inert], [aria-hidden=true], .ui-sheet:not(.is-open)')) continue
        const r = e.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) continue
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const hits = (x: number, y: number) => {
          const h = document.elementFromPoint(x, y)
          return !!h && (h === e || e.contains(h))
        }
        if (!hits(cx, cy)) continue // tertutup elemen lain (mis. tab bar), bukan target saat ini
        const probes: [number, number][] = []
        if (r.height < 44) probes.push([cx, cy - 21.5], [cx, cy + 21.5])
        if (r.width < 44) probes.push([cx - 21.5, cy], [cx + 21.5, cy])
        const miss = probes.filter(([x, y]) => !hits(x, y))
        if (miss.length) {
          const label = (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20)
          const got = miss.map(([x, y]) => {
            const h = document.elementFromPoint(x, y)
            return h ? `${h.tagName.toLowerCase()}.${String(h.className).split(" ")[0]}"${(h.textContent ?? "").slice(0, 12)}" @${Math.round(y)} in ${String(e.parentElement?.className)} top=${Math.round(r.top)}` : "null"
          })
          out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${label}" ${Math.round(r.width)}×${Math.round(r.height)} → ${got.join(',')}`)
        }
      }
      return [...new Set(out)]
    })
    if (small.length) bad[path] = small
  }
  console.log('[ukur] target < 44', JSON.stringify(bad, null, 1))
  expect(bad).toEqual({})
})

/*
 * AC-UI-03 / BUG-10 · kontras teks informatif ≥ 4.5:1 di kedua tema. Memindai semua teks yang terlihat
 * (warna teks vs latar efektif terdekat). Dikecualikan hanya peran tersier menurut DESIGN.md §2:
 * kontrol nonaktif, placeholder/nol nominal kosong, dan label tab tidak aktif.
 */
test('AC-UI-03 · kontras teks informatif ≥ 4.5:1 (light & dark)', async ({ page }) => {
  test.setTimeout(120_000)
  const d = await boot(page)
  await seedTx(page, d, [
    { amount: 100000, date: '2026-11-10', note: 'Kopi' },
    { amount: 50000, category: 'Transportasi', date: '2026-11-11' },
    { type: 'income', amount: 1000000, category: 'Gaji', date: '2026-11-01' },
    { amount: 30000, date: '2026-10-11' },
  ])
  const makan = d.categories.find((c) => c.name === 'Makan & Minum')!.id
  await putRows(page, 'budgets', [{ id: 'b1', categoryId: makan, amount: 120000, startPeriod: '2026-10', createdAt: 1, updatedAt: 1 }])
  const acc = d.accounts.find((a) => a.name === 'Tunai')!.id
  const bad: Record<string, string[]> = {}
  for (const theme of ['light', 'dark']) {
    await setSettingsRaw(page, { theme })
    for (const path of ['/', '/ringkasan', '/anggaran', '/akun', `/akun/${acc}`, '/cari?q=kopi', '/pengaturan', '/pengaturan/data', '/?sheet=add']) {
      await reload(page, path)
      await page.waitForFunction(() => (document.querySelector('.ui-screen, .tx-sheet')?.textContent ?? '').length > 60)
      if (path.includes('sheet=')) await expect(page.locator('.ui-sheet.is-open')).toBeVisible()
      await page.waitForTimeout(400)
      const found = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d')!
        const rgba = (v: string): number[] => {
          const m = v.match(/[\d.]+/g)
          if (!m) return [0, 0, 0, 0]
          if (v.startsWith('color(')) return [0, 1, 2].map((i) => Number(m[i]) * 255).concat(m[3] !== undefined ? Number(m[3]) : 1)
          return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] !== undefined ? Number(m[3]) : 1]
        }
        void ctx
        const lum = ([r, g, b]: number[]) => {
          const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const bgOf = (el: Element | null): number[] => {
          for (let e = el; e; e = e.parentElement) {
            const c = rgba(getComputedStyle(e).backgroundColor)
            if (c[3] > 0.5) return c
          }
          return rgba(getComputedStyle(document.body).backgroundColor)
        }
        const skip = '[disabled], :disabled, .ui-tab:not(.is-active), .ui-amount-display.is-empty, [inert], [aria-hidden=true], .ui-sheet:not(.is-open), .ui-toast-region'
        const out: string[] = []
        let checked = 0
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue
          const el = n.parentElement!
          if (el.closest(skip)) continue
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
          let fg = rgba(cs.color)
          const bg = bgOf(el)
          if (fg[3] < 1) fg = fg.map((v, i) => (i < 3 ? v * fg[3] + bg[i] * (1 - fg[3]) : 1))
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
          const ratio = (a + 0.05) / (b + 0.05)
          checked++
          // teks besar (≥ 24 px, atau ≥ 18.66 px tebal) cukup 3:1
          const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)
          if (ratio < (large ? 3 : 4.5)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${n.textContent.trim().slice(0, 18)}" ${ratio.toFixed(2)}`)
        }
        return { out: [...new Set(out)], checked }
      })
      expect(found.checked, `teks terpindai di ${path}`).toBeGreaterThan(5)
      if (found.out.length) bad[`${theme} ${path}`] = found.out
    }
  }
  console.log('[ukur] kontras < 4.5', JSON.stringify(bad, null, 1))
  expect(bad).toEqual({})
})

// BUG-09: FAB melayang di atas konten (pola standar), tetapi ruang scroll bawah harus cukup sehingga
// setelah digulir ke bawah tidak ada teks/nominal/bar yang tertutup FAB — juga bila konten pendek.
test('BUG-09 · setelah scroll ke bawah, FAB tidak menutupi konten di tab mana pun', async ({ page }) => {
  const d = await boot(page)
  const specs = Array.from({ length: 14 }, (_, i) => ({ amount: 10000 + i * 1000, date: `2026-11-${String(5 + i).padStart(2, '0')}`, note: `Item ${i}` }))
  await seedTx(page, d, [...specs, { type: 'income' as const, amount: 1000000, category: 'Gaji', date: '2026-10-25' }, { amount: 20000, category: 'Transportasi', date: '2026-09-11' }])
  const makan = d.categories.find((c) => c.name === 'Makan & Minum')!.id
  const trans = d.categories.find((c) => c.name === 'Transportasi')!.id
  await putRows(page, 'budgets', [makan, trans].map((categoryId, i) => ({ id: `b${i}`, categoryId, amount: 500000, startPeriod: '2026-09', createdAt: 1, updatedAt: 1 })))
  const covered: Record<string, string[]> = {}
  for (const path of ['/', '/ringkasan', '/anggaran', '/akun']) {
    await reload(page, path)
    await page.waitForFunction(() => (document.querySelector('.ui-screen')?.textContent ?? '').length > 60)
    await page.waitForTimeout(300)
    await page.locator('.ui-screen__scroll').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(300)
    const hit = await page.evaluate(() => {
      const fab = document.querySelector('.ui-fab')!.getBoundingClientRect()
      const out: string[] = []
      const els = document.querySelectorAll<Element>('.ui-screen__scroll *')
      for (const el of Array.from(els)) {
        const leaf = el.children.length === 0 && ((el.textContent ?? '').trim() || el instanceof SVGPathElement)
        if (!leaf) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if (r.right > fab.left && r.left < fab.right && r.bottom > fab.top && r.top < fab.bottom)
          out.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 16)}"`)
      }
      return out
    })
    if (hit.length) covered[path] = hit
  }
  expect(covered).toEqual({})
})
