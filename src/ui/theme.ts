/* Penerapan tema & ukuran teks ke <html> (PRD §3.7, DESIGN.md §2.1, §3). */

export type ThemePref = 'system' | 'light' | 'dark'
export type TextScale = 'standard' | 'large' | 'larger'

const SCALE: Record<TextScale, number> = { standard: 1, large: 1.12, larger: 1.24 }

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  const meta = document.querySelector('meta[name="color-scheme"]')
  meta?.setAttribute('content', pref === 'system' ? 'light dark' : pref)
}

export function applyTextScale(scale: TextScale) {
  document.documentElement.style.setProperty('--text-scale', String(SCALE[scale]))
}

/** Tema efektif saat ini (untuk chart/kanvas yang butuh tahu). */
export function resolvedTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
