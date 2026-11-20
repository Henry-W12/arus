/*
 * Infrastruktur overlay bersama (BottomSheet, ConfirmDialog):
 * - siklus mount → animasi masuk → animasi keluar → unmount
 * - tumpukan overlay: elemen di belakang overlay teratas diberi `inert` (fokus & sentuh terkunci)
 * - Escape menutup overlay teratas, Tab terperangkap, fokus dikembalikan saat tutup
 * - variabel visualViewport (--vv-h, --kb) agar sheet tetap di atas keyboard iOS
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/* ---------- Tumpukan & inert ---------- */

const stack: HTMLElement[] = []
const inertByUs = new Set<Element>()

function syncInert() {
  inertByUs.forEach((el) => el.removeAttribute('inert'))
  inertByUs.clear()
  const top = stack[stack.length - 1]
  if (!top) {
    document.documentElement.classList.remove('has-overlay')
    return
  }
  document.documentElement.classList.add('has-overlay')
  for (const child of Array.from(document.body.children)) {
    if (child === top || child.contains(top) || child.hasAttribute('inert')) continue
    if (child.tagName === 'SCRIPT' || child.hasAttribute('data-overlay-exempt')) continue
    child.setAttribute('inert', '')
    inertByUs.add(child)
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  )
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type OverlayPhase = 'closed' | 'entering' | 'open' | 'leaving'

interface OverlayOptions {
  open: boolean
  onClose: () => void
  /** Elemen root overlay (portal) */
  ref: RefObject<HTMLElement | null>
  /** Durasi animasi keluar (ms) sebelum unmount */
  exitMs: number
  /** Tampil langsung tanpa animasi masuk (cold start openToAdd) */
  instant?: boolean
  initialFocus?: RefObject<HTMLElement | null>
}

/**
 * Mengembalikan fase overlay. Render konten bila phase !== 'closed';
 * beri kelas "is-open" bila phase === 'open'.
 */
export function useOverlay({ open, onClose, ref, exitMs, instant, initialFocus }: OverlayOptions): OverlayPhase {
  const [phase, setPhase] = useState<OverlayPhase>(open ? (instant ? 'open' : 'entering') : 'closed')
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const restoreRef = useRef<HTMLElement | null>(null)

  // Transisi fase
  useEffect(() => {
    if (open) {
      if (phase === 'closed' || phase === 'leaving') setPhase(instant && phase === 'closed' ? 'open' : 'entering')
      return
    }
    if (phase === 'open' || phase === 'entering') {
      setPhase('leaving')
      const t = window.setTimeout(() => setPhase('closed'), prefersReducedMotion() ? 130 : exitMs)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (phase !== 'entering') return
    // Paksa reflow agar transisi dari posisi awal berjalan, lalu buka.
    ref.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setPhase('open'))
    return () => cancelAnimationFrame(id)
  }, [phase, ref])

  // Daftar di tumpukan, inert, fokus
  const mounted = phase !== 'closed'
  useLayoutEffect(() => {
    if (!mounted) return
    const el = ref.current
    if (!el) return
    restoreRef.current = document.activeElement as HTMLElement | null
    stack.push(el)
    syncInert()
    // Default: fokus ke kontainer dialog (tanpa cincin fokus, tanpa memunculkan keyboard).
    const target = initialFocus?.current ?? el.querySelector<HTMLElement>('[role="dialog"],[role="alertdialog"]') ?? el
    target.focus({ preventScroll: true })
    return () => {
      const i = stack.indexOf(el)
      if (i >= 0) stack.splice(i, 1)
      syncInert()
      const r = restoreRef.current
      if (r && document.contains(r)) r.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // Escape & perangkap Tab — hanya overlay teratas
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current
      if (!el || stack[stack.length - 1] !== el) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab') {
        const list = focusables(el)
        if (list.length === 0) {
          e.preventDefault()
          el.focus()
          return
        }
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !el.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !el.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [mounted, ref])

  return phase
}

/** true bila elemen ini overlay teratas (mis. untuk menahan shortcut keypad). */
export function isTopOverlay(el: HTMLElement | null): boolean {
  return !!el && stack[stack.length - 1] === el
}

export function overlayCount(): number {
  return stack.length
}

/* ---------- visualViewport ---------- */

/**
 * Menulis --vv-h (tinggi area terlihat) dan --kb (tinggi keyboard) ke <html>,
 * serta kelas `kb-open`. Panggil sekali di root app.
 */
export function useViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const h = vv ? vv.height : window.innerHeight
        const top = vv ? vv.offsetTop : 0
        let kb = Math.round(window.innerHeight - h - top)
        // iOS 26: offsetTop kadang tidak kembali ke 0 setelah keyboard ditutup.
        const editing = isEditable(document.activeElement)
        if (kb < 80 || !editing) kb = 0
        root.style.setProperty('--vv-h', `${Math.round(kb > 0 ? h : window.innerHeight)}px`)
        root.style.setProperty('--kb', `${kb}px`)
        root.classList.toggle('kb-open', kb > 0)
      })
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
}

function isEditable(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'file', 'color'].includes(el.type)
  }
  return (el as HTMLElement).isContentEditable === true
}
