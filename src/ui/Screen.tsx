import { useRef, useState, type ReactNode, type UIEvent } from 'react'
import { Icon } from './icons'
import { useEdgeSwipeBack } from './router'

export interface ScreenProps {
  /** Judul nav bar. Large Title tampil di konten dan menyusut ke judul inline saat scroll > 40 px. */
  title: ReactNode
  /** Large Title (default true untuk layar akar tab). */
  large?: boolean
  /** Tombol back "‹ <label>" + swipe dari tepi kiri. */
  back?: { label: string; onBack: () => void }
  /** Aksi di kanan nav bar (IconButton/tombol teks). */
  actions?: ReactNode
  /** Elemen tengah nav bar menggantikan judul inline (mis. navigator periode). */
  center?: ReactNode
  children: ReactNode
  /** Ruang bawah ekstra untuk tab bar + FAB (default true). */
  withTabBar?: boolean
  className?: string
}

/** Kerangka layar: nav bar gaya iOS + area scroll (DESIGN.md §6.9). */
export function Screen({ title, large = true, back, actions, center, children, withTabBar = true, className }: ScreenProps) {
  const [scrolled, setScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(!large)
  const ref = useRef<HTMLDivElement>(null)
  useEdgeSwipeBack(back ? back.onBack : null, ref)

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop
    const s = y > 1
    const c = !large || y > 40
    if (s !== scrolled) setScrolled(s)
    if (c !== collapsed) setCollapsed(c)
  }

  return (
    <div ref={ref} className={['ui-screen', withTabBar && 'has-tabbar', className].filter(Boolean).join(' ')}>
      <header className={['ui-nav', scrolled && 'is-scrolled', collapsed && 'is-collapsed'].filter(Boolean).join(' ')}>
        <div className="ui-nav__bar">
          <div className="ui-nav__left">
            {back && (
              <button type="button" className="ui-nav__back" onClick={back.onBack}>
                <Icon name="chevron-left" size={24} strokeWidth={2} />
                <span>{back.label}</span>
              </button>
            )}
          </div>
          <div className="ui-nav__center">{center ?? <span className="ui-nav__title">{title}</span>}</div>
          <div className="ui-nav__right">{actions}</div>
        </div>
      </header>
      <div className="ui-screen__scroll" onScroll={onScroll}>
        {large && !center && <h1 className="ui-nav__large">{title}</h1>}
        {children}
      </div>
    </div>
  )
}
