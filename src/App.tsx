/*
 * Root app Arus (fase 3c): boot DB → kunci PIN → shell (layar + tab bar + sheet input).
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { onDatabaseVersionChange } from './db/db'
import { initDatabase, type InitResult } from './db/init'
import { getSettings, runRecurring } from './db/repo'
import type { Settings } from './db/schema'
import { useSettings, useToday } from './lib/hooks'
import { shouldLockOnResume } from './lib/pin'
import {
  applyTextScale,
  applyTheme,
  ArusMark,
  Button,
  matchPath,
  RouterProvider,
  ROUTES,
  TabBar,
  ToastProvider,
  UpdatePrompt,
  useRouter,
  useSheet,
  useToast,
  useViewportVars,
  type TextScale,
} from './ui'
import { AccountDetailScreen } from './screens/AccountDetail'
import { AccountsScreen } from './screens/Accounts'
import { BudgetsScreen } from './screens/Budgets'
import { LockScreen } from './screens/LockScreen'
import { Onboarding } from './screens/Onboarding'
import { SearchScreen } from './screens/Search'
import { CategoriesScreen } from './screens/settings/Categories'
import { DataScreen } from './screens/settings/Data'
import { FavoritesScreen } from './screens/settings/Favorites'
import { RecurringScreen } from './screens/settings/Recurring'
import { SecurityScreen } from './screens/settings/Security'
import { SettingsScreen } from './screens/settings/Settings'
import { SummaryScreen } from './screens/Summary'
import { TransactionsScreen } from './screens/Transactions'
import { TxSheet } from './screens/TxSheet'
import { appStore, useAppStore } from './screens/store'
import './styles/screens.css'

// Galeri komponen hanya di dev (tidak ikut build produksi).
const Gallery = import.meta.env.DEV ? lazy(() => import('./ui/Gallery')) : null

const SCALE: Record<number, TextScale> = { 1: 'standard', 1.12: 'large', 1.24: 'larger' }

let bootPromise: Promise<InitResult> | null = null
const boot = () => (bootPromise ??= initDatabase(undefined, { runGenerator: false }))

export default function App() {
  useViewportVars()
  return (
    <RouterProvider>
      <ToastProvider>
        <Boot />
      </ToastProvider>
    </RouterProvider>
  )
}

type BootState = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; firstRun: boolean; locked: boolean }

function Boot() {
  const router = useRouter()
  const toast = useToast()
  const [st, setSt] = useState<BootState>({ phase: 'loading' })
  const [onboarding, setOnboarding] = useState(false)
  const [hidden, setHidden] = useState(false)
  const settings = useSettings()
  const sheetBusy = useAppStore((s) => s.sheetBusy)
  const routerRef = useRef(router)
  routerRef.current = router

  useEffect(() => {
    let alive = true
    boot()
      .then(async (r) => {
        const s: Settings = await getSettings()
        if (!alive) return
        appStore.noteRecurring(r.recurring.created, r.recurring.since)
        applyTheme(s.theme)
        applyTextScale(SCALE[s.textScale] ?? 'standard')
        const q = new URLSearchParams(location.search)
        const wantAdd = q.get('add') === '1' || (s.openToAdd && !r.seeded && location.pathname === '/' && !q.get('sheet'))
        if (wantAdd && !q.get('sheet')) {
          q.delete('add')
          q.set('sheet', 'add')
          appStore.setInstantSheet(true)
          routerRef.current.navigate(`${location.pathname}?${q.toString()}`, { replace: true })
        }
        setOnboarding(r.seeded)
        setSt({ phase: 'ready', firstRun: r.seeded, locked: !!s.pin })
        // Generator berulang setelah layar pertama tampil; hasil masuk lewat liveQuery + banner.
        void runRecurring().then((rec) => alive && appStore.noteRecurring(rec.created, rec.since))
      })
      .catch((e: unknown) => {
        if (alive) setSt({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
      })
    return () => {
      alive = false
    }
  }, [])

  // Tema & ukuran teks mengikuti setting (live).
  useEffect(() => {
    if (!settings) return
    applyTheme(settings.theme)
    applyTextScale(SCALE[settings.textScale] ?? 'standard')
  }, [settings])

  // DB dibuka versi baru di tab lain.
  useEffect(
    () =>
      onDatabaseVersionChange(() =>
        toast.show({ message: 'Data diperbarui di jendela lain', action: { label: 'Muat ulang', onAction: () => location.reload() }, duration: Infinity }),
      ),
    [toast],
  )

  // Kunci saat kembali dari background + layar kosong untuk app switcher.
  const hiddenAt = useRef<number | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  useEffect(() => {
    const onVis = () => {
      const s = settingsRef.current
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        if (s?.pin) setHidden(true)
        return
      }
      setHidden(false)
      if (s?.pin && shouldLockOnResume(hiddenAt.current, Date.now(), s.autoLockMinutes)) {
        setSt((p) => (p.phase === 'ready' ? { ...p, locked: true } : p))
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (st.phase === 'loading') return <div className="s-boot" />
  if (st.phase === 'error')
    return (
      <div className="s-fatal">
        <ArusMark size={40} className="s-fatal__mark" />
        <p className="s-fatal__title">Data tidak bisa dibuka</p>
        <p className="s-fatal__desc">
          Penyimpanan perangkat mungkin penuh atau diblokir. Tutup tab Arus lain lalu muat ulang.
          <br />
          <span className="ink-3">{st.message}</span>
        </p>
        <Button variant="secondary" onClick={() => location.reload()}>
          Muat ulang
        </Button>
      </div>
    )

  const locked = st.locked && !!settings?.pin
  return (
    <>
      {hidden ? (
        <div className="s-boot" />
      ) : locked ? (
        <LockScreen onUnlock={() => setSt({ ...st, locked: false })} />
      ) : (
        <Shell />
      )}
      {onboarding && !locked && (
        <Onboarding
          onDone={() => {
            setOnboarding(false)
            routerRef.current.navigate('/?sheet=add', { replace: true })
          }}
        />
      )}
      <UpdatePrompt blocked={locked || sheetBusy} />
    </>
  )
}

const TAB_ROOTS: string[] = [ROUTES.transactions, ROUTES.summary, ROUTES.budgets, ROUTES.accounts]

function Shell() {
  const { path, navigate } = useRouter()
  const { sheet, open } = useSheet()
  const today = useToday()

  // Generator berulang: saat tanggal berganti & saat app kembali terlihat.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void runRecurring(today).then((r) => appStore.noteRecurring(r.created, r.since))
  }, [today])
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      void runRecurring().then((r) => appStore.noteRecurring(r.created, r.since))
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const accountMatch = matchPath(ROUTES.accountDetail, path)
  let screen
  if (Gallery && path === ROUTES.gallery)
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    )
  switch (path) {
    case ROUTES.transactions:
      screen = <TransactionsScreen />
      break
    case ROUTES.search:
      screen = <SearchScreen />
      break
    case ROUTES.summary:
      screen = <SummaryScreen />
      break
    case ROUTES.budgets:
      screen = <BudgetsScreen />
      break
    case ROUTES.accounts:
      screen = <AccountsScreen />
      break
    case ROUTES.settings:
      screen = <SettingsScreen />
      break
    case ROUTES.categories:
      screen = <CategoriesScreen />
      break
    case ROUTES.favorites:
      screen = <FavoritesScreen />
      break
    case ROUTES.recurring:
      screen = <RecurringScreen />
      break
    case ROUTES.data:
      screen = <DataScreen />
      break
    case ROUTES.security:
      screen = <SecurityScreen />
      break
    default:
      screen = accountMatch ? <AccountDetailScreen key={accountMatch.id} id={accountMatch.id} /> : <NotFound onHome={() => navigate('/', { replace: true })} />
  }

  return (
    <>
      <div className="s-stage" key={path}>
        {screen}
      </div>
      <TabBar hidden={!!sheet} showAdd={TAB_ROOTS.includes(path)} onAdd={() => open('add')} />
      <TxSheet />
    </>
  )
}

function NotFound({ onHome }: { onHome: () => void }) {
  useEffect(() => onHome(), [onHome])
  return null
}
