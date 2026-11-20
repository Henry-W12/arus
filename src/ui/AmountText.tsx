import type { HTMLAttributes } from 'react'
import { formatDigits, formatRp, formatShort, MINUS } from './format'

export type AmountKind = 'expense' | 'income' | 'transfer' | 'balance' | 'plain'

export interface AmountTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Integer Rupiah. Untuk expense/income/transfer berikan nilai absolut (tanda dari `kind`). */
  value: number
  /**
   * expense  → "−Rp 25.000" warna ink (bukan merah)
   * income   → "+Rp 8.500.000" warna positive
   * transfer → "Rp 500.000" tanpa tanda, ink-2
   * balance  → tanpa tanda bila ≥ 0; "−Rp …" warna negative bila < 0
   * plain    → tanpa tanda, mewarisi warna
   */
  kind?: AmountKind
  /** body (default, 500) · title · amount-l · hero */
  size?: 'body' | 'title' | 'amount-l' | 'hero' | 'inherit'
  /** Format singkat (25rb, 1,2jt). */
  short?: boolean
  /** Redupkan 60% (transaksi terjadwal). */
  muted?: boolean
}

/** Nominal terformat dengan warna & tanda sesuai DESIGN.md. Selalu tabular-nums. */
export function AmountText({ value, kind = 'plain', size = 'body', short, muted, className, ...rest }: AmountTextProps) {
  const abs = Math.abs(value)
  let sign = ''
  if (kind === 'expense' && abs > 0) sign = MINUS
  else if (kind === 'income' && abs > 0) sign = '+'
  else if ((kind === 'balance' || kind === 'plain') && value < 0) sign = MINUS
  const body = short ? formatShort(abs, true) : formatRp(abs)
  const tone =
    kind === 'income' ? 'is-positive' : kind === 'transfer' ? 'is-muted' : kind === 'balance' && value < 0 ? 'is-negative' : ''

  const big = size === 'hero' || size === 'amount-l'
  return (
    <span
      className={['ui-amount', `ui-amount--${size}`, tone, muted && 'is-dim', 'num', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {big ? (
        <>
          {sign && <span className="ui-amount__sign">{sign}</span>}
          <span className="ui-amount__rp">Rp</span>
          {short ? formatShort(abs) : formatDigits(abs)}
        </>
      ) : (
        sign + body
      )}
    </span>
  )
}
