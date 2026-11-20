/*
 * Router kecil di atas History API (PRD §3). Tanpa library.
 * - path + query dari window.location; berubah lewat navigate()/popstate
 * - sheet sebagai state query (?sheet=add, ?sheet=tx&id=…) agar gestur back menutup sheet
 * - history.state.idx untuk tahu apakah back() masih di dalam app
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'

export const ROUTES = {
  transactions: '/',
  summary: '/ringkasan',
  budgets: '/anggaran',
  accounts: '/akun',
  accountDetail: '/akun/:id',
  search: '/cari',
  settings: '/pengaturan',
  categories: '/pengaturan/kategori',
  favorites: '/pengaturan/favorit',
  recurring: '/pengaturan/berulang',
  data: '/pengaturan/data',
  security: '/pengaturan/keamanan',
  gallery: '/_gallery',
} as const

export type TabId = 'transactions' | 'summary' | 'budgets' | 'accounts'

/** Tab yang aktif untuk sebuah path (layar turunan ikut induknya). */
export function tabForPath(path: string): TabId {
  if (path.startsWith('/ringkasan')) return 'summary'
  if (path.startsWith('/anggaran')) return 'budgets'
  if (path.startsWith('/akun') || path.startsWith('/pengaturan')) return 'accounts'
  return 'transactions'
}

/** Cocokkan pola "/akun/:id" → { id } atau null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

interface Loc {
  path: string
  search: string
  idx: number
}

export interface NavigateOptions {
  replace?: boolean
  /** Data tambahan di history.state (selain idx). */
  state?: Record<string, unknown>
}

export interface Router {
  path: string
  query: URLSearchParams
  /** Navigasi ke path (+ ?query). */
  navigate: (to: string, opts?: NavigateOptions) => void
  /** Kembali; bila tidak ada riwayat di dalam app → `fallback` (default '/') dengan replace. */
  back: (fallback?: string) => void
  /** true bila ada entri riwayat sebelumnya milik app. */
  canGoBack: boolean
  /** Set/hapus parameter query pada path sekarang. `null` menghapus. */
  setQuery: (patch: Record<string, string | null>, opts?: NavigateOptions) => void
}

const RouterCtx = createContext<Router | null>(null)

function readLoc(): Loc {
  const st = (history.state ?? {}) as { idx?: number }
  return { path: location.pathname || '/', search: location.search, idx: st.idx ?? 0 }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(() => {
    if (typeof (history.state as { idx?: number } | null)?.idx !== 'number') {
      history.replaceState({ ...(history.state ?? {}), idx: 0 }, '')
    }
    return readLoc()
  })
  const locRef = useRef(loc)
  locRef.current = loc

  useEffect(() => {
    const onPop = () => setLoc(readLoc())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string, opts?: NavigateOptions) => {
    const url = new URL(to, location.href)
    if (url.origin !== location.origin) {
      location.href = to
      return
    }
    const cur = locRef.current
    const target = url.pathname + url.search
    if (target === cur.path + cur.search) return
    const idx = opts?.replace ? cur.idx : cur.idx + 1
    const state = { ...(opts?.state ?? {}), idx }
    if (opts?.replace) history.replaceState(state, '', target)
    else history.pushState(state, '', target)
    setLoc({ path: url.pathname, search: url.search, idx })
  }, [])

  const back = useCallback(
    (fallback = '/') => {
      if (locRef.current.idx > 0) history.back()
      else navigate(fallback, { replace: true })
    },
    [navigate],
  )

  const setQuery = useCallback(
    (patch: Record<string, string | null>, opts?: NavigateOptions) => {
      const cur = locRef.current
      const q = new URLSearchParams(cur.search)
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) q.delete(k)
        else q.set(k, v)
      }
      const s = q.toString()
      navigate(cur.path + (s ? `?${s}` : ''), opts)
    },
    [navigate],
  )

  const value = useMemo<Router>(
    () => ({
      path: loc.path,
      query: new URLSearchParams(loc.search),
      navigate,
      back,
      canGoBack: loc.idx > 0,
      setQuery,
    }),
    [loc, navigate, back, setQuery],
  )

  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>
}

export function useRouter(): Router {
  const r = useContext(RouterCtx)
  if (!r) throw new Error('useRouter harus di dalam <RouterProvider>')
  return r
}

/** Parameter rute untuk pola tertentu, mis. useParams('/akun/:id')?.id */
export function useParams(pattern: string): Record<string, string> | null {
  return matchPath(pattern, useRouter().path)
}

/**
 * Sheet sebagai state URL. open('add') → push ?sheet=add; close() → back bila sheet
 * dibuka dari app (gestur back menutup sheet), atau replace bila datang dari URL langsung.
 */
export function useSheet(): {
  sheet: string | null
  params: URLSearchParams
  open: (name: string, extra?: Record<string, string>) => void
  close: () => void
} {
  const r = useRouter()
  const sheet = r.query.get('sheet')
  const { setQuery } = r
  const open = useCallback(
    (name: string, extra: Record<string, string> = {}) => {
      setQuery({ sheet: name, ...extra }, { state: { sheetFromApp: true } })
    },
    [setQuery],
  )
  const close = useCallback(() => {
    const st = (history.state ?? {}) as { sheetFromApp?: boolean }
    if (st.sheetFromApp) {
      history.back()
      return
    }
    setQuery({ sheet: null, id: null, mode: null }, { replace: true })
  }, [setQuery])
  return { sheet, params: r.query, open, close }
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  replace?: boolean
}

export function Link({ to, replace, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to, { replace })
  }
  return <a href={to} onClick={handle} {...rest} />
}

/**
 * Swipe dari tepi kiri (≤ 24 px) dan geser > 30% lebar → onBack.
 * Pasang di container layar turunan.
 */
export function useEdgeSwipeBack(onBack: (() => void) | null, ref: RefObject<HTMLElement | null>) {
  const cb = useRef(onBack)
  cb.current = onBack
  useEffect(() => {
    const el = ref.current
    if (!el || !onBack) return
    let start: { x: number; y: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.clientX > 24) return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      const dy = Math.abs(e.clientY - start.y)
      start = null
      if (dx > window.innerWidth * 0.3 && dy < dx) cb.current?.()
    }
    const cancel = () => (start = null)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [ref, onBack])
}
