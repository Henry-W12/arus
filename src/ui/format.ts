/*
 * Format Rupiah ringan untuk komponen UI (PRD §5.10).
 * Lapisan domain (src/lib) boleh punya versi lengkap; komponen UI cukup ini.
 */

const NBSP = String.fromCharCode(0xa0)
export const MINUS = '−'
const nf = new Intl.NumberFormat('id-ID')

/** "1.250.000" (tanpa tanda, tanpa Rp). */
export function formatDigits(n: number): string {
  return nf.format(Math.abs(Math.trunc(n)))
}

/** "Rp 1.250.000" — selalu tanpa tanda (tanda ditambah oleh AmountText). */
export function formatRp(n: number): string {
  return 'Rp' + NBSP + formatDigits(n)
}

/** "25rb", "1,2jt", "1,2M" — dipotong ke bawah 1 desimal. */
export function formatShort(n: number, withRp = false): string {
  const a = Math.abs(Math.trunc(n))
  const units: [number, string][] = [
    [1e9, 'M'],
    [1e6, 'jt'],
    [1e3, 'rb'],
  ]
  let out = String(a)
  for (const [base, suffix] of units) {
    if (a >= base) {
      const v = Math.floor((a * 10) / base) / 10
      out = String(v).replace('.', ',') + suffix
      break
    }
  }
  return withRp ? 'Rp' + NBSP + out : out
}
