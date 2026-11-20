/*
 * Shell sementara (fase 3b). Layar sesungguhnya dibangun di fase 3c (src/screens).
 */
import { lazy, Suspense } from 'react'
import { EmptyState, RouterProvider, Screen, TabBar, ToastProvider, UpdatePrompt, useRouter, useViewportVars, ROUTES } from './ui'

const Gallery = import.meta.env.DEV ? lazy(() => import('./ui/Gallery')) : null

const TITLES: Record<string, string> = {
  [ROUTES.transactions]: 'Transaksi',
  [ROUTES.summary]: 'Ringkasan',
  [ROUTES.budgets]: 'Anggaran',
  [ROUTES.accounts]: 'Akun',
}

function Routes() {
  const { path } = useRouter()
  if (Gallery && path === ROUTES.gallery) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    )
  }
  return (
    <>
      <Screen title={TITLES[path] ?? 'Arus'}>
        <EmptyState icon="list" title="Sedang disiapkan" description="Layar ini dibangun pada tahap berikutnya." />
      </Screen>
      <TabBar showAdd={false} />
    </>
  )
}

export default function App() {
  useViewportVars()
  return (
    <RouterProvider>
      <ToastProvider>
        <Routes />
        <UpdatePrompt />
      </ToastProvider>
    </RouterProvider>
  )
}
