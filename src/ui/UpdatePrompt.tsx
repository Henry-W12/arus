/// <reference types="vite-plugin-pwa/react" />
import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from './Toast'

const THROTTLE_MS = 30 * 60 * 1000

export interface UpdatePromptProps {
  /** Tahan toast (sheet input berisi data / layar terkunci). Ditampilkan setelah false. */
  blocked?: boolean
}

/**
 * Registrasi service worker (registerType 'prompt') + toast persisten
 * "Versi baru tersedia · Muat ulang". Cek update saat app kembali terlihat (maks 1×/30 menit).
 */
export function UpdatePrompt({ blocked }: UpdatePromptProps) {
  const toast = useToast()
  const lastCheck = useRef(0)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      lastCheck.current = Date.now()
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return
        if (Date.now() - lastCheck.current < THROTTLE_MS) return
        lastCheck.current = Date.now()
        if (navigator.onLine) reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', onVisible)
    },
  })

  useEffect(() => {
    if (!needRefresh || blocked) {
      if (blocked) toast.dismiss('sw-update')
      return
    }
    toast.show({
      id: 'sw-update',
      message: 'Versi baru tersedia',
      action: { label: 'Muat ulang', onAction: () => void updateServiceWorker(true) },
      duration: Infinity,
    })
  }, [needRefresh, blocked, toast, updateServiceWorker])

  return null
}

/** Panggil manual dari Pengaturan → "Periksa pembaruan". */
export async function checkForUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return false
  await reg.update()
  return !!reg.waiting
}
