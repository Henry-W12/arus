/* J. Backup & data (AC-BK-*), CSV, restore file rusak. */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { boot, dumpDb, getSetting, putRows, reload, seedTx, setSettingsRaw, transactions, type Dump } from './helpers'

/** Paksa jalur unduhan (desktop) — WebKit Playwright tidak punya share sheet. */
async function forceDownload(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
  })
}

async function richData(page: Page, d: Dump) {
  const now = Date.now()
  // Kategori dipilih per nama: urutan dump mengikuti UUID acak (dulu kadang kategori pemasukan → flaky).
  const cat = (n: string) => d.categories.find((c) => c.name === n && c.kind === 'expense')!.id
  await putRows(page, 'budgets', [{ id: 'b1', categoryId: cat('Makan & Minum'), amount: 2000000, startPeriod: '2026-10', createdAt: now, updatedAt: now }])
  await putRows(page, 'templates', [{ id: 't1', label: 'Kopi', type: 'expense', amount: 25000, categoryId: cat('Makan & Minum'), sortOrder: 0, useCount: 3, createdAt: now, updatedAt: now }])
  await putRows(page, 'recurring', [
    {
      id: 'r1', type: 'expense', amount: 2400000, accountId: d.accounts[1].id, categoryId: cat('Tempat Tinggal'), note: 'Kos',
      frequency: 'monthly', interval: 1, anchorDate: '2026-12-01', generatedCount: 0, nextDate: '2026-12-01', active: 1, createdAt: now, updatedAt: now,
    },
  ])
  return seedTx(page, d, [
    { amount: 25000, note: 'Kopi, "susu", gula\naren' },
    { amount: 48000, note: 'Café — été' },
    { type: 'income', amount: 12500000, category: 'Gaji', account: 'Rekening Bank', date: '2026-11-01' },
    { type: 'transfer', amount: 750000, account: 'Rekening Bank', to: 'E-Wallet', date: '2026-11-12' },
    { type: 'adjustment', amount: -12500, date: '2026-11-15' },
  ], '/pengaturan/data')
}

const strip = (d: Dump) => {
  const s = { ...d } as Record<string, unknown[]>
  const DEVICE = ['pin', 'pinLockState', 'persistGranted', 'lastBackupAt', 'installHintDismissedAt', 'backupReminderSnoozedUntil', 'txCountAtLastBackup']
  s.settings = (d.settings as { key: string }[]).filter((r) => !DEVICE.includes(r.key))
  for (const k of Object.keys(s)) s[k] = [...s[k]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return s
}

test('AC-BK-02/04/10 · backup JSON → hapus semua → restore: semua tabel identik, tanpa hash PIN', async ({ page }) => {
  await forceDownload(page)
  const d = await boot(page)
  await richData(page, d)
  await setSettingsRaw(page, { pin: { hash: 'HASHRAHASIA', salt: 'GARAM', iterations: 150000 } })
  const before = await dumpDb(page)
  await reload(page, '/pengaturan/data')
  // PIN aktif → layar kunci; hapus PIN agar alur fokus pada backup
  await setSettingsRaw(page, { pin: null })
  await reload(page, '/pengaturan/data')
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Buat backup (JSON)' }).click()
  const file = await dl
  expect(file.suggestedFilename()).toBe('arus-backup-2026-11-20.json')
  const path = test.info().outputPath('backup.json')
  await file.saveAs(path)
  const json = readFileSync(path, 'utf8')
  expect(json).not.toContain('HASHRAHASIA')
  const parsed = JSON.parse(json)
  expect(parsed.app).toBe('arus')
  expect(parsed.data.transactions).toHaveLength(5)
  await expect(page.locator('.ui-toast')).toContainText('Backup dibuat')
  expect(await getSetting(page, 'lastBackupAt')).toBeGreaterThan(0)

  // Hapus semua data (ketik HAPUS)
  await page.getByText('Hapus semua data', { exact: true }).first().click()
  const sh = page.locator('.ui-sheet.is-open')
  const confirm = sh.getByRole('button', { name: 'Hapus semua data' })
  await expect(confirm).toBeDisabled()
  await sh.getByRole('textbox').fill('HAPU')
  await expect(confirm).toBeDisabled()
  // BUG-11: huruf kecil/campuran tidak diterima — harus persis HAPUS
  await sh.getByRole('textbox').fill('hapus')
  await expect(confirm).toBeDisabled()
  await sh.getByRole('textbox').fill('Hapus')
  await expect(confirm).toBeDisabled()
  await sh.getByRole('textbox').fill('HAPUS')
  await confirm.click()
  await expect(page).toHaveURL(/\/$|\/\?/)
  const wiped = await dumpDb(page)
  expect(wiped.transactions).toHaveLength(0)
  expect(wiped.categories.length).toBe(18) // AC-BK-09 seed ulang

  await reload(page, '/pengaturan/data')
  await page.locator('input[type=file]').setInputFiles(path)
  const pv = page.locator('.ui-sheet.is-open')
  await expect(pv).toContainText('5 transaksi')
  await expect(pv).toContainText('Semua data saat ini (0 transaksi) akan diganti')
  await pv.getByRole('button', { name: 'Ganti data' }).click()
  await expect(page.locator('.ui-toast')).toContainText('Data dipulihkan')
  const after = await dumpDb(page)
  expect(strip(after)).toEqual(strip(before))
})

test('AC-BK-03/05 · restore file rusak / bukan Arus / referensi salah / schema lebih baru → ditolak, data utuh', async ({ page }) => {
  const d = await boot(page)
  await seedTx(page, d, [{ amount: 1111 }, { amount: 2222 }], '/pengaturan/data')
  const before = await dumpDb(page)
  const dir = test.info().outputPath('')
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(dir, { recursive: true })
  const files: [string, string, RegExp][] = [
    ['rusak.json', '{"app":"arus", "format":1, "data": {', /tidak valid|rusak|JSON|dibaca/i],
    ['lain.json', JSON.stringify({ app: 'mint', format: 1, data: {} }), /bukan|Arus|tidak valid/i],
    [
      'ref.json',
      JSON.stringify({
        app: 'arus', format: 1, schemaVersion: 1, exportedAt: '2026-11-20T08:00:00.000+07:00',
        data: { ...before, settings: [], transactions: [{ ...before.transactions[0], accountId: 'tidak-ada' }] },
      }),
      /akun yang tidak ada|tidak valid/i,
    ],
    ['baru.json', JSON.stringify({ app: 'arus', format: 1, schemaVersion: 99, exportedAt: '2026-11-20T08:00:00.000+07:00', data: before }), /Perbarui app/i],
  ]
  for (const [name, body, msg] of files) {
    const p = `${dir}/${name}`
    writeFileSync(p, body)
    await page.locator('input[type=file]').setInputFiles(p)
    await expect(page.locator('.ui-toast')).toContainText(msg)
    await expect(page.locator('.ui-sheet.is-open')).toHaveCount(0)
    await page.locator('input[type=file]').setInputFiles([])
  }
  expect((await transactions(page)).length).toBe(2)
  expect(strip(await dumpDb(page)).transactions).toEqual(strip(before).transactions)
})

test('AC-BK-07 · ekspor CSV: BOM, CRLF, kolom, quoting koma/kutip/baris baru, tanda negatif', async ({ page }) => {
  await forceDownload(page)
  const d = await boot(page)
  await richData(page, d)
  const dl = page.waitForEvent('download')
  await page.getByText('Ekspor CSV', { exact: true }).click()
  await page.getByRole('button', { name: 'Semua transaksi' }).click()
  const file = await dl
  expect(file.suggestedFilename()).toMatch(/^arus-transaksi-.*\.csv$/)
  const p = test.info().outputPath('x.csv')
  await file.saveAs(p)
  const buf = readFileSync(p)
  expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = buf.toString('utf8').slice(1)
  const lines = text.split('\r\n')
  expect(lines[0]).toBe('Tanggal,Jenis,Nominal,Kategori,Akun,Akun Tujuan,Catatan')
  expect(text).toContain('"Kopi, ""susu"", gula\naren"')
  expect(text).toContain('Café — été')
  expect(text).toMatch(/2026-11-20,Pengeluaran,-25000,Makan & Minum,Tunai,,/)
  expect(text).toMatch(/2026-11-12,Transfer,-750000,,Rekening Bank,E-Wallet,/)
  expect(text).toMatch(/2026-11-15,Penyesuaian,-12500,/)
  expect(text).toMatch(/2026-11-01,Pemasukan,12500000,Gaji,Rekening Bank,,/)
  // CSV tidak memengaruhi lastBackupAt
  expect(await getSetting(page, 'lastBackupAt')).toBe(new Date('2026-11-20T10:00:00+07:00').getTime())
})

test('AC-BK-01 · jalur share iOS: resolve → lastBackupAt terbarui; batal (AbortError) → tidak', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: string[]; __abort: boolean }
    w.__shared = []
    w.__abort = true
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: { files: File[] }) => {
        w.__shared.push(d.files[0].name)
        if (w.__abort) throw new DOMException('batal', 'AbortError')
      },
    })
  })
  await boot(page, { settings: { lastBackupAt: null } })
  await reload(page, '/pengaturan/data')
  await page.getByRole('button', { name: 'Buat backup (JSON)' }).click()
  await page.waitForTimeout(500)
  expect(await getSetting(page, 'lastBackupAt')).toBeNull()
  await page.evaluate(() => ((window as unknown as { __abort: boolean }).__abort = false))
  await page.getByRole('button', { name: 'Buat backup (JSON)' }).click()
  await expect(page.locator('.ui-toast')).toContainText('Backup dibuat')
  expect(await getSetting(page, 'lastBackupAt')).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared)).toEqual(['arus-backup-2026-11-20.json', 'arus-backup-2026-11-20.json'])
})

test('AC-BK-08 · pengingat backup: muncul >7 hari + ada transaksi baru; "Nanti" sembunyi; Mati → tidak muncul', async ({ page }) => {
  const d = await boot(page, { settings: { lastBackupAt: new Date('2026-11-01T10:00:00+07:00').getTime(), txCountAtLastBackup: 0 } })
  await seedTx(page, d, [{ amount: 1000 }])
  const banner = page.locator('.s-banner', { hasText: 'backup' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Nanti' }).click()
  await expect(banner).toHaveCount(0)
  await reload(page)
  await expect(page.locator('.s-banner', { hasText: 'backup' })).toHaveCount(0)
  await setSettingsRaw(page, { backupReminderSnoozedUntil: null, backupReminderDays: 0 })
  await reload(page)
  await expect(page.locator('.s-banner', { hasText: 'backup' })).toHaveCount(0)
  await setSettingsRaw(page, { backupReminderDays: 7 })
  await reload(page)
  await expect(page.locator('.s-banner', { hasText: 'backup' })).toBeVisible()
})
