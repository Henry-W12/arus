import { useId, useRef, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { prefersReducedMotion, useOverlay } from './overlay'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 'full' = tinggi viewport − safe-top − 8 (input/edit). 'auto' = tinggi konten, maks 90%. */
  detent?: 'full' | 'auto'
  /** Judul di header (opsional). Dipakai juga sebagai nama aksesibel. */
  title?: ReactNode
  /** Nama aksesibel bila tanpa judul teks. */
  ariaLabel?: string
  /** Slot kiri/kanan header (mis. "Batal", ikon trash). */
  headerLeft?: ReactNode
  headerRight?: ReactNode
  /** Slot tengah header menggantikan judul (mis. SegmentedControl). */
  headerCenter?: ReactNode
  /** Area bawah yang tidak ikut scroll (mis. keypad). */
  footer?: ReactNode
  /** Tampil tanpa animasi masuk (cold start openToAdd). */
  instant?: boolean
  /** Elemen yang difokus pertama kali. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Matikan drag-to-dismiss. */
  disableDrag?: boolean
  className?: string
}

const EXIT_MS = 260

export function BottomSheet({
  open,
  onClose,
  children,
  detent = 'auto',
  title,
  ariaLabel,
  headerLeft,
  headerRight,
  headerCenter,
  footer,
  instant,
  initialFocus,
  disableDrag,
  className,
}: BottomSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const phase = useOverlay({ open, onClose, ref: rootRef, exitMs: EXIT_MS, instant, initialFocus })
  const drag = useRef<{ y0: number; t0: number; lastY: number; lastT: number; v: number; id: number } | null>(null)

  if (phase === 'closed') return null

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (disableDrag || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="tablist"], [data-no-drag]')) return
    const now = performance.now()
    drag.current = { y0: e.clientY, t0: now, lastY: e.clientY, lastT: now, v: 0, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const panel = panelRef.current
    if (!d || !panel || e.pointerId !== d.id) return
    const now = performance.now()
    const dy = Math.max(0, e.clientY - d.y0)
    const dt = now - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = now
    panel.style.transition = 'none'
    panel.style.transform = `translateY(${dy}px)`
  }
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const panel = panelRef.current
    drag.current = null
    if (!d || !panel) return
    const dy = Math.max(0, e.clientY - d.y0)
    const h = panel.getBoundingClientRect().height
    panel.style.transition = ''
    if (dy > h * 0.25 || (d.v > 0.5 && dy > 8)) {
      // Lanjutkan dari posisi jari ke bawah; elemen di-unmount setelah animasi keluar.
      panel.style.transform = 'translateY(calc(100% + var(--kb, 0px)))'
      onClose()
      // Bila induk menolak menutup (mis. konfirmasi "Buang perubahan?"), kembalikan posisi.
      window.setTimeout(() => {
        if (panel.isConnected) panel.style.transform = ''
      }, EXIT_MS + 140)
    } else {
      panel.style.transform = ''
    }
  }

  const hasHeader = title || headerLeft || headerRight || headerCenter
  const cls = [
    'ui-sheet',
    `ui-sheet--${detent}`,
    phase === 'open' && 'is-open',
    instant && phase === 'open' && 'is-instant',
    prefersReducedMotion() && 'is-reduced',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div ref={rootRef} className={cls} tabIndex={-1}>
      <div className="ui-sheet__scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="ui-sheet__panel"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title && !headerCenter ? titleId : undefined}
        aria-label={title && !headerCenter ? undefined : ariaLabel}
      >
        <div
          className="ui-sheet__top"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="ui-sheet__grabber" aria-hidden="true" />
          {hasHeader && (
            <div className="ui-sheet__header">
              <div className="ui-sheet__hl">{headerLeft}</div>
              <div className="ui-sheet__hc">
                {headerCenter ??
                  (title && (
                    <h2 id={titleId} className="ui-sheet__title">
                      {title}
                    </h2>
                  ))}
              </div>
              <div className="ui-sheet__hr">{headerRight}</div>
            </div>
          )}
        </div>
        <div className="ui-sheet__body">{children}</div>
        {footer && <div className="ui-sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
