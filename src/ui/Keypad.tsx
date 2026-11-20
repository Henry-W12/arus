import { useEffect, useRef, type MouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Icon } from './icons'
import { formatDigits } from './format'

/* ================= Keypad ================= */

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'back'

export interface KeypadProps {
  /** Nominal saat ini (integer Rupiah ≥ 0). */
  value: number
  onChange: (value: number) => void
  /** Maks digit (default 12, PRD §4.3). */
  maxDigits?: number
  /** Dipanggil saat input ditolak (digit melebihi batas) — untuk animasi geleng. */
  onReject?: () => void
  /** 'amount' (dengan 000) atau 'pin' (sel kiri bawah kosong). */
  variant?: 'amount' | 'pin'
  /** Untuk PIN: kendali penuh atas tombol (value/onChange diabaikan). */
  onKey?: (key: KeypadKey) => void
  /** Tombol Simpan lebar penuh di atas keypad. */
  submit?: { label?: string; disabled?: boolean; onSubmit: () => void; hint?: ReactNode }
  /** Tangkap keyboard fisik (0–9, Backspace, Enter, Escape). */
  captureKeyboard?: boolean
  onEscape?: () => void
  disabled?: boolean
  className?: string
}

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', 'back'],
]

/** Terapkan satu tombol ke nominal. Mengembalikan null bila ditolak. */
export function applyKey(value: number, key: KeypadKey, maxDigits = 12): number | null {
  const s = value > 0 ? String(value) : ''
  if (key === 'back') return s.length <= 1 ? 0 : Number(s.slice(0, -1))
  if (s === '' && (key === '0' || key === '000')) return value // diabaikan, bukan ditolak
  const room = maxDigits - s.length
  if (room <= 0) return null
  const add = key.slice(0, room)
  return Number(s + add)
}

const LABEL: Record<KeypadKey, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '000': 'Tiga nol',
  back: 'Hapus satu digit',
}

export function Keypad({
  value,
  onChange,
  maxDigits = 12,
  onReject,
  variant = 'amount',
  onKey,
  submit,
  captureKeyboard,
  onEscape,
  disabled,
  className,
}: KeypadProps) {
  const valueRef = useRef(value)
  valueRef.current = value
  const holdTimer = useRef<number | undefined>(undefined)
  const held = useRef(false)

  const press = (key: KeypadKey) => {
    if (disabled) return
    if (onKey) return onKey(key)
    const next = applyKey(valueRef.current, key, maxDigits)
    if (next === null) onReject?.()
    else if (next !== valueRef.current) {
      valueRef.current = next
      onChange(next)
    }
  }
  const pressRef = useRef(press)
  pressRef.current = press

  const submitRef = useRef(submit)
  submitRef.current = submit
  const escRef = useRef(onEscape)
  escRef.current = onEscape

  useEffect(() => {
    if (!captureKeyboard) return
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        pressRef.current(e.key as KeypadKey)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        pressRef.current('back')
      } else if (e.key === 'Enter') {
        const s = submitRef.current
        if (s && !s.disabled) {
          e.preventDefault()
          s.onSubmit()
        }
      } else if (e.key === 'Escape' && escRef.current) {
        e.preventDefault()
        escRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [captureKeyboard])

  useEffect(() => () => window.clearTimeout(holdTimer.current), [])

  const onDown = (key: KeypadKey) => (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault() // respons instan, tanpa fokus/zoom
    const el = e.currentTarget
    el.classList.add('is-pressed')
    held.current = false
    press(key)
    if (key === 'back' && !onKey) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = window.setTimeout(() => {
        held.current = true
        if (valueRef.current !== 0) {
          valueRef.current = 0
          onChange(0)
        }
      }, 500)
    }
  }
  const onUp = (e: RPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('is-pressed')
    window.clearTimeout(holdTimer.current)
  }
  // Aktivasi dari VoiceOver / keyboard (tanpa pointerdown) → detail === 0
  const onClick = (key: KeypadKey) => (e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) press(key)
  }

  return (
    <div className={['ui-keypad', className].filter(Boolean).join(' ')}>
      {submit && (
        <div className="ui-keypad__submit">
          {submit.hint && <p className="ui-keypad__hint">{submit.hint}</p>}
          <button
            type="button"
            className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block"
            disabled={submit.disabled || disabled}
            onClick={submit.onSubmit}
          >
            {submit.label ?? 'Simpan'}
          </button>
        </div>
      )}
      <div className="ui-keypad__grid" role="group" aria-label="Keypad nominal">
        {ROWS.flat().map((key) => {
          if (variant === 'pin' && key === '000') return <span key={key} aria-hidden="true" />
          return (
            <button
              key={key}
              type="button"
              className={['ui-key', key === '000' && 'ui-key--000', key === 'back' && 'ui-key--back'].filter(Boolean).join(' ')}
              aria-label={LABEL[key]}
              disabled={disabled}
              onPointerDown={onDown(key)}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={onUp}
              onClick={onClick(key)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {key === 'back' ? <Icon name="backspace" size={26} /> : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ================= AmountDisplay ================= */

export interface AmountDisplayProps {
  value: number
  /** Masuk = warna positive; Keluar/Transfer = ink. */
  mode?: 'expense' | 'income' | 'transfer'
  /** Naikkan angka ini untuk memicu animasi geleng (digit ditolak). */
  shakeKey?: number
  className?: string
}

/** Nominal besar terpusat "Rp 25.000" (DESIGN.md §6.2). */
export function AmountDisplay({ value, mode = 'expense', shakeKey = 0, className }: AmountDisplayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const digits = value > 0 ? String(value).length : 0
  const size = digits > 11 ? 's' : digits > 9 ? 'm' : 'l'
  const text = formatDigits(value)

  useEffect(() => {
    if (!shakeKey || !ref.current) return
    const el = ref.current
    el.classList.remove('is-shake')
    void el.offsetWidth
    el.classList.add('is-shake')
  }, [shakeKey])

  // Animasi hanya pada digit paling kanan (digit yang baru masuk).
  const head = text.slice(0, -1)
  const last = text.slice(-1)

  return (
    <div
      ref={ref}
      className={[
        'ui-amount-display',
        `ui-amount-display--${size}`,
        mode === 'income' && 'is-income',
        value === 0 && 'is-empty',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-label={`Rp ${text}`}
    >
      <span className="ui-amount-display__rp" aria-hidden="true">
        Rp
      </span>
      <span className="ui-amount-display__num num" aria-hidden="true">
        {head}
        <span key={digits} className={value > 0 ? 'ui-amount-display__new' : undefined}>
          {last}
        </span>
      </span>
    </div>
  )
}
