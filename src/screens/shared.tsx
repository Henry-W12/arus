/*
 * Komponen & helper bersama layar (fase 3c): baris transaksi, daftar per hari, navigator periode,
 * banner, sheet pemilih (akun, tanggal, kategori, pilihan), sheet nominal, grid ikon/warna.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Account, Category, CategoryKind, ColorToken, IconName as EntityIcon, ID, LocalDate, PeriodKey, Transaction } from '../db/schema'
import { COLOR_TOKENS } from '../db/iconIds'
import { deleteTransaction, restoreTransaction } from '../db/repo'
import { transactionEffect } from '../lib/balances'
import { isScheduled } from '../lib/effective'
import {
  addDays,
  dayLabel,
  daysInMonth,
  formatDateMedium,
  MONTHS_LONG,
  parseLocalDate,
  weekdayMon0,
  formatYMD,
} from '../lib/dates'
import type { Lookup } from '../lib/hooks'
import { useBalances } from '../lib/hooks'
import { formatIDR } from '../lib/money'
import { formatPeriodLabel, formatPeriodRange, shiftPeriod, type Period } from '../lib/period'
import type { DayGroup } from '../lib/summary'
import {
  AmountDisplay,
  AmountText,
  BottomSheet,
  CategoryIcon,
  Icon,
  Keypad,
  ListGroup,
  ListRow,
  SectionHeader,
  SegmentedControl,
  TextField,
  useToast,
  type IconName,
} from '../ui'
import { appStore, useAppStore } from './store'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------ sheet state */

/** State sheet yang datanya tetap ada selama animasi keluar. */
export function useSheetState<T>() {
  const [s, setS] = useState<{ open: boolean; data: T | null }>({ open: false, data: null })
  const show = useCallback((data: T) => setS({ open: true, data }), [])
  const hide = useCallback(() => setS((p) => ({ ...p, open: false })), [])
  return { open: s.open, data: s.data, show, hide }
}

/** Nomor sesi yang naik setiap kali `open` berubah ke true (pakai sebagai `key` untuk reset form). */
export function useOpenSession(open: boolean): number {
  const [session, setSession] = useState(0)
  const [was, setWas] = useState(open)
  if (open !== was) {
    setWas(open)
    if (open) setSession((s) => s + 1)
  }
  return session
}

/* ------------------------------------------------------------ transaksi */

export interface TxView {
  title: string
  subtitle: string
  icon: IconName
  color: ColorToken | 'neutral'
}

export function describeTx(tx: Transaction, lookup: Lookup): TxView {
  const acc = lookup.accounts.get(tx.accountId)?.name ?? 'Akun'
  if (tx.type === 'transfer') {
    const to = (tx.toAccountId && lookup.accounts.get(tx.toAccountId)?.name) || 'Akun'
    return { title: `${acc} → ${to}`, subtitle: tx.note ? `Transfer · ${tx.note}` : 'Transfer', icon: 'arrows-swap', color: 'neutral' }
  }
  if (tx.type === 'adjustment') {
    return { title: tx.note || 'Penyesuaian saldo', subtitle: acc, icon: 'scale', color: 'neutral' }
  }
  const cat = tx.categoryId ? lookup.categories.get(tx.categoryId) : undefined
  const catName = cat?.name ?? 'Tanpa kategori'
  return {
    title: tx.note || catName,
    subtitle: tx.note ? `${catName} · ${acc}` : acc,
    icon: (cat?.icon ?? 'dots') as IconName,
    color: cat?.color ?? 'c12',
  }
}

/** Nominal baris: dari sudut pandang akun (detail akun) atau global. */
export function TxAmount({ tx, accountId, muted }: { tx: Transaction; accountId?: ID; muted?: boolean }) {
  if (accountId && (tx.type === 'transfer' || tx.type === 'adjustment')) {
    const eff = transactionEffect(tx, accountId)
    return <AmountText value={Math.abs(eff)} kind={eff < 0 ? 'expense' : 'income'} muted={muted} />
  }
  if (tx.type === 'adjustment') return <AmountText value={Math.abs(tx.amount)} kind={tx.amount < 0 ? 'expense' : 'income'} muted={muted} />
  return <AmountText value={tx.amount} kind={tx.type} muted={muted} />
}

/** Teks toast singkat untuk transaksi: "Makan & Minum −Rp 25.000". */
export function txToastLabel(tx: Transaction, lookup: Lookup | undefined): string {
  const name =
    tx.type === 'transfer'
      ? 'Transfer'
      : (tx.categoryId && lookup?.categories.get(tx.categoryId)?.name) || (tx.type === 'adjustment' ? 'Penyesuaian' : '')
  const amount =
    tx.type === 'expense' ? formatIDR(-tx.amount) : tx.type === 'income' ? formatIDR(tx.amount, 'always') : formatIDR(tx.amount)
  return `${name} ${amount}`.trim()
}

export function useDeleteTx() {
  const toast = useToast()
  return useCallback(
    async (tx: Transaction) => {
      const old = await deleteTransaction(tx.id)
      if (!old) return
      toast.show({
        message: 'Transaksi dihapus',
        action: { label: 'Urungkan', onAction: () => void restoreTransaction(old) },
      })
    },
    [toast],
  )
}

interface DayListProps {
  groups: DayGroup[]
  today: LocalDate
  lookup: Lookup
  onOpen: (tx: Transaction) => void
  onDelete?: (tx: Transaction) => void
  /** Detail akun: tanda nominal dari sudut pandang akun + saldo berjalan. */
  accountId?: ID
  running?: Map<ID, number>
  /** Muat bertahap (baris). */
  pageSize?: number
}

/** Daftar transaksi per hari dengan header sticky (dibungkus <section> per hari). */
export function DayList({ groups, today, lookup, onOpen, onDelete, accountId, running, pageSize = 250 }: DayListProps) {
  const [limit, setLimit] = useState(pageSize)
  const sentinel = useRef<HTMLDivElement>(null)
  const highlightId = useAppStore((s) => s.highlightId)
  const highlightKey = useAppStore((s) => s.highlightKey)

  const visible = useMemo(() => {
    const out: DayGroup[] = []
    let n = 0
    for (const g of groups) {
      if (n >= limit) break
      out.push(n + g.items.length > limit ? { ...g, items: g.items.slice(0, limit - n) } : g)
      n += g.items.length
    }
    return out
  }, [groups, limit])
  const total = useMemo(() => groups.reduce((s, g) => s + g.items.length, 0), [groups])
  const more = total > limit

  useEffect(() => {
    const el = sentinel.current
    if (!el || !more || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + pageSize), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, pageSize])

  return (
    <div className="s-daylist">
      {visible.map((g) => {
        const future = isScheduled(g, today)
        const hasFlow = g.items.some((t) => t.type === 'income' || t.type === 'expense')
        return (
          <section key={g.date}>
            <SectionHeader
              sticky
              title={dayLabel(g.date, today)}
              trailing={
                hasFlow ? (
                  <AmountText value={Math.abs(g.net)} kind={g.net > 0 ? 'income' : g.net < 0 ? 'expense' : 'plain'} size="inherit" />
                ) : undefined
              }
            />
            <ListGroup>
              {g.items.map((tx) => {
                const v = describeTx(tx, lookup)
                const hl = tx.id === highlightId
                return (
                  <ListRow
                    key={hl ? `${tx.id}-${highlightKey}` : tx.id}
                    leading={<CategoryIcon icon={v.icon} color={v.color} />}
                    title={v.title}
                    subtitle={v.subtitle}
                    subtitleIcon={tx.recurringId ? 'repeat' : undefined}
                    trailing={<TxAmount tx={tx} accountId={accountId} muted={future} />}
                    trailingSub={running?.has(tx.id) ? `Saldo ${formatIDR(running.get(tx.id)!)}` : undefined}
                    highlight={hl}
                    onClick={() => onOpen(tx)}
                    onDelete={onDelete ? () => onDelete(tx) : undefined}
                  />
                )
              })}
            </ListGroup>
          </section>
        )
      })}
      {more && <div ref={sentinel} className="s-sentinel" aria-hidden="true" />}
    </div>
  )
}

/** Hapus highlight setelah 1,2 dtk agar tidak terulang saat layar dibuka lagi. */
export function useHighlightReset() {
  const key = useAppStore((s) => s.highlightKey)
  useEffect(() => {
    if (!key) return
    const t = window.setTimeout(() => {
      appStore.clearHighlight(key)
    }, 1400)
    return () => window.clearTimeout(t)
  }, [key])
}

/* ------------------------------------------------------------ periode */

export interface PeriodNavProps {
  period: Period
  onChange: (key: PeriodKey) => void
  /** Batas bawah (periode transaksi pertama). */
  min?: PeriodKey | null
  /** Batas atas (periode berjalan). */
  max: PeriodKey
  showRange?: boolean
}

export function PeriodNav({ period, onChange, min, max, showRange }: PeriodNavProps) {
  const canPrev = !min || period.key > min
  const canNext = period.key < max
  return (
    <div className="s-period">
      <button type="button" className="s-period__btn" aria-label="Periode sebelumnya" disabled={!canPrev} onClick={() => onChange(shiftPeriod(period.key, -1))}>
        <Icon name="chevron-left" size={20} strokeWidth={2} />
      </button>
      <div className="s-period__label">
        <span className="s-period__title">{formatPeriodLabel(period.key)}</span>
        {showRange && <span className="s-period__range num">{formatPeriodRange(period)}</span>}
      </div>
      <button type="button" className="s-period__btn" aria-label="Periode berikutnya" disabled={!canNext} onClick={() => onChange(shiftPeriod(period.key, 1))}>
        <Icon name="chevron-right" size={20} strokeWidth={2} />
      </button>
    </div>
  )
}

/** Swipe horizontal pada konten → pindah periode. */
export function useHorizontalSwipe(onSwipe: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = t.clientX < 24 ? null : { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) > 70 && Math.abs(dy) < 40) onSwipe(dx < 0 ? 1 : -1)
    },
  }
}

/* ------------------------------------------------------------ banner */

export function Banner({
  icon = 'info',
  tone,
  children,
  action,
  secondary,
  onClose,
}: {
  icon?: IconName
  tone?: 'warning'
  children: ReactNode
  action?: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
  onClose?: () => void
}) {
  return (
    <div className={cx('s-banner', tone && `is-${tone}`)} role="note">
      <Icon name={icon} size={20} className="s-banner__icon" />
      <div className="s-banner__body">
        <p className="s-banner__text">{children}</p>
        {(action || secondary) && (
          <div className="s-banner__actions">
            {action && (
              <button type="button" className="s-banner__btn" onClick={action.onClick}>
                {action.label}
              </button>
            )}
            {secondary && (
              <button type="button" className="s-banner__btn is-muted" onClick={secondary.onClick}>
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      {onClose && (
        <button type="button" className="s-banner__close" aria-label="Tutup" onClick={onClose}>
          <Icon name="x" size={17} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ baris pengaturan */

/** Baris nilai (label kiri, nilai kanan, chevron). */
export function ValueRow({
  title,
  value,
  onClick,
  icon,
  tone,
  chevron = true,
}: {
  title: ReactNode
  value?: ReactNode
  onClick?: () => void
  icon?: { name: IconName; color: ColorToken | 'neutral' }
  tone?: 'accent' | 'negative'
  chevron?: boolean
}) {
  return (
    <ListRow
      className={cx('s-vrow', tone && `is-${tone}`)}
      leading={icon ? <CategoryIcon icon={icon.name} color={icon.color} /> : undefined}
      title={title}
      trailing={value !== undefined ? <span className="s-vrow__value">{value}</span> : undefined}
      chevron={chevron && !!onClick}
      onClick={onClick}
    />
  )
}

export function GroupLabel({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return <SectionHeader title={children} action={action} className="s-grouplabel" />
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="s-footnote">{children}</p>
}

/* ------------------------------------------------------------ sheet nominal */

export interface AmountSheetProps {
  open: boolean
  onClose: () => void
  title: string
  initial: number
  /** Izinkan tanda − (saldo awal / saldo nyata). `initial` boleh negatif. */
  allowNegative?: boolean
  /** Izinkan menyimpan 0. */
  allowZero?: boolean
  info?: (value: number) => ReactNode
  saveLabel?: string
  canSave?: (value: number) => boolean
  onSave: (value: number) => void | Promise<void>
  extra?: ReactNode
}

export function AmountSheet(props: AmountSheetProps) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={props.title} detent="auto" className="s-amount-sheet">
      <AmountSheetBody {...props} />
    </BottomSheet>
  )
}

function AmountSheetBody({ initial, allowNegative, allowZero, info, saveLabel, canSave, onSave, onClose, extra }: AmountSheetProps) {
  const [value, setValue] = useState(Math.abs(initial))
  const [neg, setNeg] = useState(initial < 0)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const signed = neg ? -value : value
  const ok = (allowZero || value > 0) && (canSave ? canSave(signed) : true)
  const save = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await onSave(signed)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="s-amount-sheet__body">
      <div className="s-amount-sheet__display">
        {neg && value > 0 && <span className="s-amount-sheet__minus">−</span>}
        <AmountDisplay value={value} shakeKey={shake} />
      </div>
      {allowNegative && (
        <div className="s-amount-sheet__sign">
          <SegmentedControl
            ariaLabel="Tanda"
            block={false}
            value={neg ? 'neg' : 'pos'}
            onChange={(v) => setNeg(v === 'neg')}
            options={[
              { value: 'pos', label: 'Positif' },
              { value: 'neg', label: 'Negatif (utang)' },
            ]}
          />
        </div>
      )}
      {info && <div className="s-amount-sheet__info">{info(signed)}</div>}
      <Keypad
        value={value}
        onChange={setValue}
        onReject={() => setShake((s) => s + 1)}
        captureKeyboard
        onEscape={onClose}
        submit={{ label: saveLabel ?? 'Simpan', disabled: !ok || busy, onSubmit: save }}
      />
      {extra && <div className="s-amount-sheet__extra">{extra}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ pemilih akun */

export function AccountPickerSheet({
  open,
  onClose,
  title = 'Pilih akun',
  value,
  onSelect,
  exclude,
  allowNone,
}: {
  open: boolean
  onClose: () => void
  title?: string
  value: ID | null | undefined
  onSelect: (id: ID | null) => void
  exclude?: ID | null
  allowNone?: string
}) {
  const bal = useBalances()
  const accounts = (bal?.accounts ?? []).filter((a) => a.archived === 0)
  return (
    <BottomSheet open={open} onClose={onClose} title={title} detent="auto">
      <ListGroup className="s-sheet-list">
        {allowNone && (
          <ListRow title={allowNone} trailing={value == null ? <Icon name="check" size={20} className="s-check" /> : undefined} onClick={() => onSelect(null)} />
        )}
        {accounts.map((a) => (
          <ListRow
            key={a.id}
            leading={<CategoryIcon icon={a.icon} color={a.color} />}
            title={a.name}
            subtitle={formatIDR(bal?.balances.get(a.id) ?? 0)}
            disabled={a.id === exclude}
            trailing={a.id === value ? <Icon name="check" size={20} className="s-check" /> : undefined}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------ pemilih kategori */

export function CategoryPickerSheet({
  open,
  onClose,
  categories,
  value,
  onSelect,
  title = 'Pilih kategori',
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  value: ID | null | undefined
  onSelect: (id: ID) => void
  title?: string
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} detent="auto">
      <ListGroup className="s-sheet-list">
        {categories.map((c) => (
          <ListRow
            key={c.id}
            leading={<CategoryIcon icon={c.icon} color={c.color} />}
            title={c.name}
            trailing={c.id === value ? <Icon name="check" size={20} className="s-check" /> : undefined}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------ pilihan tunggal/multi */

export interface Choice<T extends string | number> {
  value: T
  label: ReactNode
  detail?: ReactNode
  icon?: { name: IconName; color: ColorToken | 'neutral' }
}

export function ChoiceSheet<T extends string | number>({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: Choice<T>[]
  value: T | null | undefined
  onSelect: (v: T) => void
  footer?: ReactNode
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} detent="auto">
      <ListGroup className="s-sheet-list">
        {options.map((o) => (
          <ListRow
            key={String(o.value)}
            leading={o.icon ? <CategoryIcon icon={o.icon.name} color={o.icon.color} /> : undefined}
            title={o.label}
            subtitle={o.detail}
            trailing={o.value === value ? <Icon name="check" size={20} className="s-check" /> : undefined}
            onClick={() => onSelect(o.value)}
          />
        ))}
      </ListGroup>
      {footer}
    </BottomSheet>
  )
}

export function MultiChoiceSheet({
  open,
  onClose,
  title,
  options,
  value,
  onChange,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: Choice<string>[]
  value: readonly string[]
  onChange: (v: string[]) => void
}) {
  const set = new Set(value)
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      detent="auto"
      headerLeft={
        value.length > 0 ? (
          <button type="button" className="s-sheet-btn" onClick={() => onChange([])}>
            Kosongkan
          </button>
        ) : undefined
      }
      headerRight={
        <button type="button" className="s-sheet-btn is-strong" onClick={onClose}>
          Selesai
        </button>
      }
    >
      <ListGroup className="s-sheet-list">
        {options.map((o) => {
          const on = set.has(o.value)
          return (
            <ListRow
              key={o.value}
              leading={o.icon ? <CategoryIcon icon={o.icon.name} color={o.icon.color} /> : undefined}
              title={o.label}
              trailing={<span className={cx('s-tick', on && 'is-on')}>{on && <Icon name="check" size={14} strokeWidth={2.5} />}</span>}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            />
          )
        })}
      </ListGroup>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------ tanggal */

export function DatePickerSheet({
  open,
  onClose,
  value,
  today,
  onSelect,
  title = 'Tanggal',
  max,
  quick = true,
}: {
  open: boolean
  onClose: () => void
  value: LocalDate
  today: LocalDate
  onSelect: (d: LocalDate) => void
  title?: string
  max?: LocalDate
  quick?: boolean
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} detent="auto">
      <DatePickerBody value={value} today={today} onSelect={onSelect} max={max ?? addDays(today, 365)} quick={quick} />
    </BottomSheet>
  )
}

const WEEK_HEAD = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function DatePickerBody({
  value,
  today,
  onSelect,
  max,
  quick,
}: {
  value: LocalDate
  today: LocalDate
  onSelect: (d: LocalDate) => void
  max: LocalDate
  quick: boolean
}) {
  const v = parseLocalDate(value)
  const [ym, setYm] = useState({ y: v.y, m: v.m })
  const first = formatYMD({ y: ym.y, m: ym.m, d: 1 })
  const lead = weekdayMon0(first)
  const n = daysInMonth(ym.y, ym.m)
  const cells: (LocalDate | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => formatYMD({ y: ym.y, m: ym.m, d: i + 1 }))]
  while (cells.length % 7) cells.push(null)
  const shift = (d: number) => {
    const m0 = ym.y * 12 + (ym.m - 1) + d
    setYm({ y: Math.floor(m0 / 12), m: (m0 % 12) + 1 })
  }
  const maxYm = parseLocalDate(max)
  const canNext = ym.y * 12 + ym.m < maxYm.y * 12 + maxYm.m
  const quicks: [string, LocalDate][] = [
    ['Hari ini', today],
    ['Kemarin', addDays(today, -1)],
    ['2 hari lalu', addDays(today, -2)],
  ]
  return (
    <div className="s-date">
      {quick && (
        <div className="s-date__quick">
          {quicks.map(([label, d]) => (
            <button key={label} type="button" className={cx('ui-chip', d === value && 'is-active')} onClick={() => onSelect(d)}>
              <span className="ui-chip__label">{label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="s-date__head">
        <span className="s-date__month">
          {MONTHS_LONG[ym.m - 1]} {ym.y}
        </span>
        <div className="s-date__nav">
          <button type="button" className="s-period__btn" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}>
            <Icon name="chevron-left" size={20} strokeWidth={2} />
          </button>
          <button type="button" className="s-period__btn" aria-label="Bulan berikutnya" disabled={!canNext} onClick={() => shift(1)}>
            <Icon name="chevron-right" size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="s-date__grid" role="grid">
        {WEEK_HEAD.map((w) => (
          <span key={w} className="s-date__wd">
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className={cx('s-date__day num', d === value && 'is-selected', d === today && 'is-today')}
              disabled={d > max}
              aria-label={formatDateMedium(d)}
              aria-pressed={d === value}
              onClick={() => onSelect(d)}
            >
              {parseLocalDate(d).d}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

/** "Hari ini", "Kemarin", "Sel, 18 Nov" (chip tanggal). */
export function shortDateLabel(date: LocalDate, today: LocalDate): string {
  return dayLabel(date, today).replace('Terjadwal · ', '')
}

/* ------------------------------------------------------------ ikon & warna */

export function IconGrid({ icons, value, color, onChange }: { icons: readonly EntityIcon[]; value: EntityIcon; color: ColorToken; onChange: (i: EntityIcon) => void }) {
  return (
    <div className="s-icongrid" role="radiogroup" aria-label="Ikon">
      {icons.map((i) => (
        <button key={i} type="button" role="radio" aria-checked={i === value} aria-label={i} className={cx('s-icongrid__cell', i === value && 'is-selected')} onClick={() => onChange(i)}>
          <CategoryIcon icon={i} color={i === value ? color : 'neutral'} size={40} />
        </button>
      ))}
    </div>
  )
}

export function ColorGrid({ value, onChange }: { value: ColorToken; onChange: (c: ColorToken) => void }) {
  return (
    <div className="s-colorgrid" role="radiogroup" aria-label="Warna">
      {COLOR_TOKENS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={`Warna ${c.slice(1)}`}
          className={cx('s-colorgrid__cell', c === value && 'is-selected')}
          style={{ ['--sw' as string]: `var(--${c})` }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ konfirmasi ketik */

export function TypeToConfirmSheet({
  open,
  onClose,
  title,
  message,
  word = 'HAPUS',
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  message: ReactNode
  word?: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} detent="auto">
      <TypeToConfirmBody message={message} word={word} confirmLabel={confirmLabel} onConfirm={onConfirm} />
    </BottomSheet>
  )
}

function TypeToConfirmBody({ message, word, confirmLabel, onConfirm }: { message: ReactNode; word: string; confirmLabel: string; onConfirm: () => void | Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="s-form">
      <p className="s-form__lead">{message}</p>
      <TextField
        value={text}
        onChange={setText}
        label={`Ketik ${word} untuk melanjutkan`}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={word}
      />
      <button
        type="button"
        className="ui-btn ui-btn--lg ui-btn--block s-danger-btn"
        disabled={text.trim().toUpperCase() !== word || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
          }
        }}
      >
        {confirmLabel}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ util */

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'QuotaExceededError') {
    return 'Gagal menyimpan. Penyimpanan perangkat penuh. Buat backup lalu kosongkan ruang.'
  }
  if (e instanceof Error && e.message) return e.message
  return 'Terjadi kesalahan'
}

export function useErrorToast() {
  const toast = useToast()
  return useCallback((e: unknown) => toast.show({ message: errorMessage(e), tone: 'error' }), [toast])
}

export function accountTypeLabel(t: Account['type']): string {
  return { cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet', other: 'Lainnya' }[t]
}

export const KIND_LABEL: Record<CategoryKind, string> = { expense: 'Pengeluaran', income: 'Pemasukan' }

/** true bila tinggi viewport < 700 (grid kategori 4×2). */
export function useCompactHeight(): boolean {
  const q = '(max-height: 699px)'
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setV(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return v
}
