import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface ToastOptions {
  message: ReactNode
  /** Aksi di kanan, mis. { label: 'Urungkan', onAction } */
  action?: { label: string; onAction: () => void }
  /** ms; default 5000. `Infinity` = persisten (toast update). */
  duration?: number
  /** Kunci untuk menghindari duplikat / menutup secara spesifik. */
  id?: string
  /** Warna peringatan error (teks pesan tetap inverse; ditandai garis negative). */
  tone?: 'default' | 'error'
}

interface ToastItem extends ToastOptions {
  key: number
}

interface ToastApi {
  show: (t: ToastOptions) => void
  dismiss: (id?: string) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast harus di dalam <ToastProvider>')
  return ctx
}

let seq = 0

/** Satu toast pada satu waktu (PRD §3.13). Letakkan sekali di root app. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const [leaving, setLeaving] = useState(false)
  /** Timer auto-hilang dan timer unmount dipisah: efek auto-hilang tidak boleh
   *  membatalkan unmount (BUG-02 — toast tak terlihat tertinggal & menangkap tap). */
  const autoTimer = useRef<number | undefined>(undefined)
  const exitTimer = useRef<number | undefined>(undefined)

  const current = useRef<ToastItem | null>(null)

  const dismiss = useCallback((id?: string) => {
    const cur = current.current
    if (!cur || (id && cur.id !== id)) return
    window.clearTimeout(autoTimer.current)
    window.clearTimeout(exitTimer.current)
    current.current = null
    setLeaving(true)
    exitTimer.current = window.setTimeout(() => {
      setItem(null)
      setLeaving(false)
    }, 160)
  }, [])

  const show = useCallback((t: ToastOptions) => {
    window.clearTimeout(autoTimer.current)
    window.clearTimeout(exitTimer.current)
    const next = { ...t, key: ++seq }
    current.current = next
    setLeaving(false)
    setItem(next)
  }, [])

  useEffect(() => {
    if (!item || leaving) return
    const d = item.duration ?? 5000
    if (!Number.isFinite(d)) return
    autoTimer.current = window.setTimeout(() => dismiss(), d)
    return () => window.clearTimeout(autoTimer.current)
  }, [item, leaving, dismiss])

  useEffect(
    () => () => {
      window.clearTimeout(autoTimer.current)
      window.clearTimeout(exitTimer.current)
    },
    [],
  )

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast-region" role="status" aria-live="polite" data-overlay-exempt="">
          {item && <ToastView key={item.key} item={item} leaving={leaving} onDismiss={() => dismiss()} />}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

function ToastView({ item, leaving, onDismiss }: { item: ToastItem; leaving: boolean; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; id: number } | null>(null)

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (leaving) return
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { y0: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !ref.current) return
    const dy = Math.max(0, e.clientY - d.y0)
    ref.current.style.transition = 'none'
    ref.current.style.transform = `translateY(${dy}px)`
    ref.current.style.opacity = String(Math.max(0, 1 - dy / 80))
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || !ref.current) return
    const dy = e.clientY - d.y0
    ref.current.style.transition = ''
    if (dy > 24) onDismiss()
    else {
      ref.current.style.transform = ''
      ref.current.style.opacity = ''
    }
  }

  return (
    <div
      ref={ref}
      className={['ui-toast', leaving && 'is-leaving', item.tone === 'error' && 'is-error'].filter(Boolean).join(' ')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden={leaving || undefined}
    >
      <span className="ui-toast__msg">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="ui-toast__action"
          tabIndex={leaving ? -1 : undefined}
          onClick={() => {
            // Pertahanan kedua: toast yang sedang keluar tidak boleh menjalankan aksi.
            if (leaving) return
            item.action!.onAction()
            onDismiss()
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  )
}
