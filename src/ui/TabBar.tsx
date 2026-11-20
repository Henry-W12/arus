import { useLayoutEffect } from 'react'
import { Icon, type IconName } from './icons'
import { ROUTES, tabForPath, useRouter, type TabId } from './router'

const TABS: { id: TabId; label: string; icon: IconName; to: string }[] = [
  { id: 'transactions', label: 'Transaksi', icon: 'list', to: ROUTES.transactions },
  { id: 'summary', label: 'Ringkasan', icon: 'chart-donut', to: ROUTES.summary },
  { id: 'budgets', label: 'Anggaran', icon: 'gauge', to: ROUTES.budgets },
  { id: 'accounts', label: 'Akun', icon: 'wallet', to: ROUTES.accounts },
]

export interface TabBarProps {
  /** Sembunyikan tab bar + FAB (sheet terbuka). Keyboard aktif disembunyikan otomatis via CSS. */
  hidden?: boolean
  /** Tampilkan FAB tambah (default true). */
  showAdd?: boolean
  onAdd?: () => void
  /** Override tab aktif (default dari path). */
  active?: TabId
}

/**
 * Tab bar 4 tab + FAB tambah (DESIGN.md §6.9). Menulis --chrome-bottom ke <html>
 * agar toast duduk di atas tab bar/FAB.
 */
export function TabBar({ hidden, showAdd = true, onAdd, active }: TabBarProps) {
  const { path, navigate } = useRouter()
  const current = active ?? tabForPath(path)

  useLayoutEffect(() => {
    const root = document.documentElement
    if (hidden) root.style.removeProperty('--chrome-bottom')
    else
      root.style.setProperty(
        '--chrome-bottom',
        showAdd && onAdd
          ? 'calc(var(--h-tabbar) + var(--safe-bottom) + 16px + 56px)'
          : 'calc(var(--h-tabbar) + var(--safe-bottom))',
      )
    return () => {
      root.style.removeProperty('--chrome-bottom')
    }
  }, [hidden, showAdd, onAdd])

  return (
    <>
      {showAdd && onAdd && (
        <button
          type="button"
          className={['ui-fab', hidden && 'is-hidden'].filter(Boolean).join(' ')}
          aria-label="Catat transaksi"
          onClick={onAdd}
          tabIndex={hidden ? -1 : 0}
        >
          <Icon name="plus" size={26} strokeWidth={2} />
        </button>
      )}
      <nav className={['ui-tabbar', hidden && 'is-hidden'].filter(Boolean).join(' ')} aria-label="Navigasi utama">
        {TABS.map((t) => {
          const on = t.id === current
          return (
            <a
              key={t.id}
              href={t.to}
              className={['ui-tab', on && 'is-active'].filter(Boolean).join(' ')}
              aria-current={on ? 'page' : undefined}
              tabIndex={hidden ? -1 : 0}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return
                e.preventDefault()
                // Ganti tab: tanpa animasi; tap tab aktif → kembali ke akar tab.
                navigate(t.to, { replace: true })
              }}
            >
              <Icon name={t.icon} size={24} filled={on} />
              <span className="ui-tab__label">{t.label}</span>
            </a>
          )
        })}
      </nav>
    </>
  )
}
