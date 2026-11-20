/*
 * Screenshot semua layar Arus (Playwright WebKit, 390×844 @3x) ke docs/screens/app-*.png.
 * Prasyarat: `npm run dev` (default http://localhost:5173). Data demo dari scripts/demo-seed.ts.
 * Pakai: node scripts/screens.mjs [light|dark|all] [filter-nama...]
 */
import { webkit } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.ARUS_URL ?? 'http://localhost:5173'
const OUT = 'docs/screens'
// ARUS_VIEWPORT=375x667 → ukuran lain (nama file diberi akhiran -375x667).
const [VW, VH] = (process.env.ARUS_VIEWPORT ?? '390x844').split('x').map(Number)
const SUFFIX = process.env.ARUS_VIEWPORT ? `-${process.env.ARUS_VIEWPORT}` : ''
const [themeArg = 'all', ...filters] = process.argv.slice(2)
const themes = themeArg === 'all' ? ['light', 'dark'] : [themeArg]
mkdirSync(OUT, { recursive: true })

const want = (name) => filters.length === 0 || filters.some((f) => name.includes(f))
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function seed(page, opts = {}) {
  await page.evaluate(async (o) => {
    const m = await import('/scripts/demo-seed.ts')
    await m.seedDemo(o)
  }, opts)
}

async function open(page, path) {
  await page.goto(BASE + path)
  await page.waitForSelector('.ui-screen, .s-lock, .s-onboard, .ui-sheet', { timeout: 15000 })
  await pause(700)
}

const SHOTS = [
  ['transactions', '/'],
  [
    'transactions-scrolled',
    '/',
    async (p) => {
      await p.evaluate(() => document.querySelector('.ui-screen__scroll')?.scrollBy(0, 640))
      await pause(500)
    },
  ],
  [
    'input',
    '/?add=1',
    async (p) => {
      for (const k of ['2', '5', '0', '0', '0']) await p.keyboard.press(k)
      await pause(300)
    },
  ],
  ['input-empty', '/?add=1'],
  [
    'input-transfer',
    '/?add=1',
    async (p) => {
      await p.click('.tx-sheet__seg [role=radio] >> nth=2')
      for (const k of ['5', '0', '0', '0', '0', '0']) await p.keyboard.press(k)
      await pause(400)
    },
  ],
  [
    'edit',
    '/',
    async (p) => {
      await p.click('.s-daylist .ui-row__content >> nth=1')
      await pause(600)
    },
  ],
  [
    'search',
    '/cari',
    async (p) => {
      await p.keyboard.type('kopi')
      await pause(500)
    },
  ],
  ['search-empty', '/cari'],
  ['summary', '/ringkasan'],
  [
    'summary-scrolled',
    '/ringkasan',
    async (p) => {
      await p.evaluate(() => document.querySelector('.ui-screen__scroll')?.scrollBy(0, 560))
      await pause(500)
    },
  ],
  ['budgets', '/anggaran'],
  ['accounts', '/akun'],
  [
    'account-detail',
    '/akun',
    async (p) => {
      await p.click('.s-accounts .ui-row__content >> nth=1')
      await pause(700)
    },
  ],
  ['settings', '/pengaturan'],
  ['categories', '/pengaturan/kategori'],
  [
    'category-edit',
    '/pengaturan/kategori',
    async (p) => {
      await p.click('.ui-row__content >> nth=1')
      await pause(600)
    },
  ],
  ['favorites', '/pengaturan/favorit'],
  ['recurring', '/pengaturan/berulang'],
  [
    'recurring-edit',
    '/pengaturan/berulang',
    async (p) => {
      await p.click('.ui-row__content >> nth=0')
      await pause(600)
    },
  ],
  ['data', '/pengaturan/data'],
  ['security', '/pengaturan/keamanan'],
]

const browser = await webkit.launch()
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, colorScheme: theme, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(`[${theme}] pageerror:`, e.message))
  page.on('console', (m) => m.type() === 'error' && console.error(`[${theme}] console:`, m.text()))

  // Pertama kali dibuka: onboarding.
  await open(page, '/')
  if (want('onboarding')) await page.screenshot({ path: `${OUT}/app-onboarding-${theme}${SUFFIX}.png` })

  await seed(page)
  for (const [name, path, act] of SHOTS) {
    if (!want(name)) continue
    await open(page, path)
    if (act) await act(page)
    await page.screenshot({ path: `${OUT}/app-${name}-${theme}${SUFFIX}.png` })
    console.log(`app-${name}-${theme}${SUFFIX}.png`)
  }

  if (want('lock')) {
    await seed(page, { pin: true })
    await open(page, '/')
    await page.keyboard.press('1')
    await page.keyboard.press('2')
    await pause(200)
    await page.screenshot({ path: `${OUT}/app-lock-${theme}${SUFFIX}.png` })
    console.log(`app-lock-${theme}${SUFFIX}.png`)
  }
  if (want('empty')) {
    await seed(page, { empty: true })
    await open(page, '/')
    await page.screenshot({ path: `${OUT}/app-empty-${theme}${SUFFIX}.png` })
    await open(page, '/ringkasan')
    await page.screenshot({ path: `${OUT}/app-empty-summary-${theme}${SUFFIX}.png` })
    await open(page, '/anggaran')
    await page.screenshot({ path: `${OUT}/app-empty-budgets-${theme}${SUFFIX}.png` })
    console.log(`app-empty-*-${theme}${SUFFIX}.png`)
  }
  await ctx.close()
}
await browser.close()
