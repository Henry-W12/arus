/*
 * Data demo realistis KHUSUS untuk skrip screenshot (scripts/screens.mjs).
 * Tidak diimpor oleh app — dimuat lewat dev server: `await import('/scripts/demo-seed.ts')`.
 */
import { db } from '../src/db/db'
import {
  addTransaction,
  addTransfer,
  createAccount,
  createRecurring,
  createTemplate,
  resetAllData,
  setBudget,
  setSettings,
  updateAccount,
  archiveAccount,
} from '../src/db/repo'
import { addDays, todayLocal } from '../src/lib/dates'
import { periodOf } from '../src/lib/period'

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export async function seedDemo(options: { empty?: boolean; pin?: boolean } = {}): Promise<void> {
  await resetAllData()
  const today = todayLocal()
  await setSettings({ installHintDismissedAt: Date.now(), openToAdd: false })
  if (options.empty) return

  const accounts = await db.accounts.orderBy('sortOrder').toArray()
  const [tunai, bank, ewallet] = accounts
  await updateAccount(tunai.id, { openingBalance: 450_000 })
  await updateAccount(bank.id, { name: 'BCA', openingBalance: 4_250_000 })
  await updateAccount(ewallet.id, { name: 'GoPay', openingBalance: 180_000 })
  const cc = await createAccount({ name: 'Kartu Kredit', type: 'other', icon: 'card', color: 'c6', openingBalance: -1_150_000, includeInTotal: 1 })
  const old = await createAccount({ name: 'Dompet lama', type: 'cash', icon: 'wallet', color: 'c12', openingBalance: 0, includeInTotal: 1 })
  await archiveAccount(old.id)

  const cats = await db.categories.toArray()
  const cat = (name: string, kind: 'expense' | 'income' = 'expense') => cats.find((c) => c.name === name && c.kind === kind)!.id
  const makan = cat('Makan & Minum')
  const transport = cat('Transportasi')
  const harian = cat('Belanja Harian')
  const tagihan = cat('Tagihan & Utilitas')
  const tinggal = cat('Tempat Tinggal')
  const belanja = cat('Belanja')
  const hiburan = cat('Hiburan & Langganan')
  const sehat = cat('Kesehatan')
  const keluarga = cat('Keluarga & Sosial')
  const sedekah = cat('Sedekah & Zakat')
  const gaji = cat('Gaji', 'income')
  const usaha = cat('Usaha & Freelance', 'income')

  const r = rng(7)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const round = (n: number, step = 500) => Math.round(n / step) * step
  const start = addDays(today, -125)

  // Aturan berulang (membuat transaksi historis ber-recurringId).
  const p0 = periodOf(start, 1).start
  await createRecurring({ type: 'expense', amount: 2_400_000, accountId: bank.id, categoryId: tinggal, note: 'Kos', frequency: 'monthly', interval: 1, anchorDate: p0 }, today)
  await createRecurring({ type: 'expense', amount: 186_000, accountId: cc.id, categoryId: hiburan, note: 'Netflix', frequency: 'monthly', interval: 1, anchorDate: addDays(p0, 13) }, today)
  await createRecurring({ type: 'income', amount: 12_500_000, accountId: bank.id, categoryId: gaji, note: 'Gaji', frequency: 'monthly', interval: 1, anchorDate: addDays(p0, 24) }, today)
  await createRecurring({ type: 'expense', amount: 50_000, accountId: tunai.id, categoryId: sedekah, note: 'Infak Jumat', frequency: 'weekly', interval: 1, anchorDate: addDays(p0, 4) }, today)

  const MEALS = ['Nasi padang', 'Kopi Kenangan', 'Bakso', 'Makan siang', 'Soto ayam', 'Martabak', 'Mie ayam', '', '', '']
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const meals = 1 + Math.floor(r() * 3)
    for (let i = 0; i < meals; i++) {
      await addTransaction({
        type: 'expense',
        amount: round(15_000 + r() * 55_000),
        date: d,
        accountId: r() < 0.55 ? tunai.id : ewallet.id,
        categoryId: makan,
        note: pick(MEALS) || undefined,
      })
    }
    if (r() < 0.6)
      await addTransaction({ type: 'expense', amount: round(11_000 + r() * 26_000), date: d, accountId: ewallet.id, categoryId: transport, note: pick(['Gojek', 'Grab', 'KRL', '']) || undefined })
    if (r() < 0.18)
      await addTransaction({ type: 'expense', amount: round(120_000 + r() * 320_000, 1000), date: d, accountId: bank.id, categoryId: harian, note: pick(['Indomaret', 'Superindo', 'Pasar']) })
    if (r() < 0.05)
      await addTransaction({ type: 'expense', amount: round(180_000 + r() * 600_000, 1000), date: d, accountId: cc.id, categoryId: belanja, note: pick(['Tokopedia', 'Uniqlo', 'Shopee']) })
    if (r() < 0.03) await addTransaction({ type: 'expense', amount: round(85_000 + r() * 200_000, 1000), date: d, accountId: tunai.id, categoryId: sehat, note: 'Apotek' })
    if (r() < 0.03) await addTransaction({ type: 'expense', amount: 200_000, date: d, accountId: bank.id, categoryId: keluarga, note: 'Kado nikahan' })
    if (d.endsWith('-05')) {
      await addTransaction({ type: 'expense', amount: 452_000, date: d, accountId: bank.id, categoryId: tagihan, note: 'Listrik PLN' })
      await addTransaction({ type: 'expense', amount: 385_000, date: d, accountId: bank.id, categoryId: tagihan, note: 'IndiHome' })
    }
    if (d.endsWith('-12') || d.endsWith('-27')) await addTransfer({ fromAccountId: bank.id, toAccountId: ewallet.id, amount: 400_000, date: d })
    if (d.endsWith('-02') || d.endsWith('-17')) await addTransfer({ fromAccountId: bank.id, toAccountId: tunai.id, amount: 1_000_000, date: d })
    if (d.endsWith('-20')) await addTransfer({ fromAccountId: bank.id, toAccountId: cc.id, amount: 1_500_000, date: d, note: 'Bayar tagihan kartu' })
    if (r() < 0.03) await addTransaction({ type: 'income', amount: round(750_000 + r() * 2_000_000, 50_000), date: d, accountId: bank.id, categoryId: usaha, note: 'Proyek desain' })
  }
  // Transaksi hari ini yang khas + satu terjadwal.
  await addTransaction({ type: 'expense', amount: 25_000, date: today, accountId: tunai.id, categoryId: makan, note: 'Kopi susu gula aren' })
  await addTransaction({ type: 'expense', amount: 1_250_000, date: addDays(today, 6), accountId: bank.id, categoryId: sehat, note: 'Premi asuransi' })

  const cur = periodOf(today, 1).key
  for (const [id, amt] of [
    [makan, 2_800_000],
    [transport, 600_000],
    [harian, 1_200_000],
    [tagihan, 900_000],
    [hiburan, 250_000],
    [belanja, 500_000],
  ] as const) {
    await setBudget(id, periodOf(addDays(today, -95), 1).key, amt)
    await setBudget(id, cur, amt)
  }

  await createTemplate({ label: 'Kopi', type: 'expense', amount: 25_000, categoryId: makan, note: 'Kopi' })
  await createTemplate({ label: 'Makan siang', type: 'expense', amount: 35_000, categoryId: makan })
  await createTemplate({ label: 'Parkir', type: 'expense', amount: 5_000, categoryId: transport, note: 'Parkir' })
  await createTemplate({ label: 'Ojek', type: 'expense', amount: 18_000, categoryId: transport, accountId: ewallet.id, note: 'Gojek' })

  const count = await db.transactions.count()
  await setSettings({ lastBackupAt: Date.now() - 3 * 86400000, txCountAtLastBackup: count, lastAccountId: tunai.id })
  if (options.pin) {
    const { hashPin } = await import('../src/lib/pin')
    await setSettings({ pin: await hashPin('123456') })
  }
}
