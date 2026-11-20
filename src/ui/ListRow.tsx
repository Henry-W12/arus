import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ================= CategoryIcon ================= */

export type CategoryColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
/** Token warna seperti disimpan di DB ('c1'–'c12'). */
export type CategoryColorToken = `c${CategoryColor}`

export interface CategoryIconProps {
  icon: IconName
  /** Warna kategori: 1–12 atau 'c1'–'c12', atau 'neutral' (transfer/penyesuaian). */
  color: CategoryColor | CategoryColorToken | 'neutral'
  /** 32 (list, glyph 18) · 44 (grid input, glyph 22) · 40 · 56 */
  size?: 32 | 40 | 44 | 56
  className?: string
}

/** Glyph kategori di squircle berwarna alfa 14%/22% (DESIGN.md §5). */
export function CategoryIcon({ icon, color, size = 32, className }: CategoryIconProps) {
  const glyph = size === 32 ? 18 : size === 40 ? 20 : size === 44 ? 22 : 28
  return (
    <span
      className={cx('ui-cat-icon', `ui-cat-icon--${size}`, className)}
      style={{ ['--cat' as string]: color === 'neutral' ? 'var(--ink-2)' : typeof color === 'number' ? `var(--c${color})` : `var(--${color})` }}
      aria-hidden="true"
    >
      <Icon name={icon} size={glyph} strokeWidth={glyph <= 18 ? 1.75 : 1.6} />
    </span>
  )
}

/* ================= ListGroup ================= */

export function ListGroup({ children, className, inset = true }: { children: ReactNode; className?: string; inset?: boolean }) {
  return <div className={cx('ui-group', inset && 'ui-group--inset', className)}>{children}</div>
}

/* ================= SectionHeader ================= */

export interface SectionHeaderProps {
  title: ReactNode
  /** Teks kanan (mis. total harian) — tabular. */
  trailing?: ReactNode
  /** Header hari: sticky, tinggi 32, blur saat menempel. */
  sticky?: boolean
  /** Aksi teks kanan (mis. "Atur"). */
  action?: { label: string; onClick: () => void }
  className?: string
}

export function SectionHeader({ title, trailing, sticky, action, className }: SectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!sticky || !ref.current || typeof IntersectionObserver === 'undefined') return
    const el = ref.current
    const io = new IntersectionObserver(([e]) => setStuck(e.intersectionRatio < 1), {
      threshold: [1],
      rootMargin: '-1px 0px 0px 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [sticky])
  return (
    <div ref={ref} className={cx('ui-section', sticky && 'ui-section--sticky', stuck && 'is-stuck', className)} role="heading" aria-level={3}>
      <span className="ui-section__title">{title}</span>
      {trailing !== undefined && <span className="ui-section__trail num">{trailing}</span>}
      {action && (
        <button type="button" className="ui-section__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

/* ================= ListRow ================= */

export interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Elemen kiri — biasanya <CategoryIcon/>. */
  leading?: ReactNode
  /** Elemen kanan — biasanya <AmountText/> atau teks nilai. */
  trailing?: ReactNode
  /** Baris kecil di bawah trailing (mis. saldo berjalan). */
  trailingSub?: ReactNode
  /** Tampilkan chevron-right (navigasi). */
  chevron?: boolean
  onClick?: () => void
  /** Aktifkan swipe-kiri → tombol Hapus. Swipe penuh > 60% → hapus langsung. */
  onDelete?: () => void
  deleteLabel?: string
  /** Sorot latar accent-soft yang memudar 1,2 dtk (baris baru). */
  highlight?: boolean
  /** Ikon kecil setelah subjudul (mis. 'repeat'). */
  subtitleIcon?: IconName
  disabled?: boolean
  className?: string
}

const DELETE_W = 88

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  trailingSub,
  chevron,
  onClick,
  onDelete,
  deleteLabel = 'Hapus',
  highlight,
  subtitleIcon,
  disabled,
  className,
}: ListRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const g = useRef<{ x0: number; y0: number; base: number; dx: number; axis: 'x' | 'y' | null; id: number } | null>(null)
  const suppressClick = useRef(false)

  const setX = (x: number, animate: boolean) => {
    const el = contentRef.current
    if (!el) return
    el.style.transition = animate ? '' : 'none'
    el.style.transform = x ? `translateX(${x}px)` : ''
    rowRef.current?.style.setProperty('--reveal', `${Math.max(0, -x)}px`)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setOpen(false)
        setX(0, true)
      }
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!onDelete || e.pointerType === 'mouse' && e.button !== 0) return
    g.current = { x0: e.clientX, y0: e.clientY, base: open ? -DELETE_W : 0, dx: 0, axis: null, id: e.pointerId }
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (s.axis === 'x') e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (s.axis !== 'x') return
    const w = rowRef.current?.offsetWidth ?? 360
    let x = Math.min(0, s.base + dx)
    if (x < -w) x = -w
    s.dx = x
    setX(x, false)
  }
  const onPointerUp = () => {
    const s = g.current
    g.current = null
    if (!s || s.axis !== 'x') return
    suppressClick.current = true
    const w = rowRef.current?.offsetWidth ?? 360
    if (-s.dx > w * 0.6) {
      setX(-w, true)
      window.setTimeout(() => onDelete?.(), 180)
      return
    }
    const shouldOpen = -s.dx > DELETE_W / 2
    setOpen(shouldOpen)
    setX(shouldOpen ? -DELETE_W : 0, true)
  }

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (open) {
      setOpen(false)
      setX(0, true)
      return
    }
    onClick?.()
  }

  const Inner = onClick ? 'button' : 'div'
  return (
    <div
      ref={rowRef}
      className={cx(
        'ui-row',
        !subtitle && 'ui-row--compact',
        leading != null && 'has-leading',
        highlight && 'is-highlight',
        onDelete && 'is-swipeable',
        className,
      )}
    >
      {onDelete && (
        <button
          type="button"
          className="ui-row__delete"
          tabIndex={open ? 0 : -1}
          aria-hidden={open ? undefined : true}
          onClick={() => onDelete()}
        >
          {deleteLabel}
        </button>
      )}
      <div
        ref={contentRef}
        className="ui-row__slide"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Inner
          {...(onClick ? { type: 'button' as const, disabled } : {})}
          className="ui-row__content"
          onClick={onClick || onDelete ? handleClick : undefined}
        >
          {leading != null && <span className="ui-row__leading">{leading}</span>}
          <span className="ui-row__main">
            <span className="ui-row__title">{title}</span>
            {subtitle && (
              <span className="ui-row__sub">
                <span className="ui-row__sub-text">{subtitle}</span>
                {subtitleIcon && <Icon name={subtitleIcon} size={13} strokeWidth={2} className="ui-row__sub-icon" />}
              </span>
            )}
          </span>
          {(trailing != null || trailingSub != null) && (
            <span className="ui-row__trail">
              {trailing != null && <span className="ui-row__trail-main num">{trailing}</span>}
              {trailingSub != null && <span className="ui-row__trail-sub num">{trailingSub}</span>}
            </span>
          )}
          {chevron && <Icon name="chevron-right" size={17} strokeWidth={2} className="ui-row__chev" />}
        </Inner>
      </div>
    </div>
  )
}
