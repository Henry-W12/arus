/*
 * State global kecil lintas layar (tanpa library): sorot baris baru, banner berulang,
 * info boot (seed pertama kali). Dibaca lewat useSyncExternalStore.
 */
import { useSyncExternalStore } from 'react'
import type { ID } from '../db/schema'

interface AppState {
  /** Baris yang baru disimpan → highlight 1,2 dtk. `highlightKey` naik tiap simpan. */
  highlightId: ID | null
  highlightKey: number
  /** Banner "N transaksi berulang dicatat" (sekali per batch). */
  recurringNotice: { count: number; since: number } | null
  /** Sheet input dibuka saat cold start → tanpa animasi. */
  instantSheet: boolean
  /** Sheet input berisi data → tahan toast update SW. */
  sheetBusy: boolean
}

let state: AppState = { highlightId: null, highlightKey: 0, recurringNotice: null, instantSheet: false, sheetBusy: false }
const listeners = new Set<() => void>()

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const appStore = {
  get: () => state,
  highlight(id: ID) {
    set({ highlightId: id, highlightKey: state.highlightKey + 1 })
  },
  clearHighlight(key: number) {
    if (state.highlightKey === key && state.highlightId) set({ highlightId: null })
  },
  noteRecurring(count: number, since: number) {
    if (count <= 0) return
    const prev = state.recurringNotice
    set({ recurringNotice: prev ? { count: prev.count + count, since: Math.min(prev.since, since) } : { count, since } })
  },
  clearRecurring() {
    set({ recurringNotice: null })
  },
  setSheetBusy(v: boolean) {
    if (state.sheetBusy !== v) set({ sheetBusy: v })
  },
  setInstantSheet(v: boolean) {
    if (state.instantSheet !== v) set({ instantSheet: v })
  },
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}
