/* Layar kunci PIN (PRD §3.12, §5.9). Konten app tidak dirender selama terkunci. */
import { useEffect, useRef, useState } from 'react'
import { resetAllData, setSetting } from '../db/repo'
import { useSettings } from '../lib/hooks'
import { nextPinLockState, PIN_LENGTH, pinLockRemainingMs, verifyPin } from '../lib/pin'
import { ArusMark, Keypad, useRouter, type KeypadKey } from '../ui'
import { TypeToConfirmSheet, cx } from './shared'

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const settings = useSettings()
  const { navigate } = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [forgot, setForgot] = useState(false)
  const dots = useRef<HTMLDivElement>(null)

  const lock = settings?.pinLockState ?? { failures: 0, lockedUntil: null }
  const remaining = pinLockRemainingMs(lock, now)
  useEffect(() => {
    if (remaining <= 0) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [remaining])

  const submit = async (value: string) => {
    if (!settings?.pin) return onUnlock()
    setChecking(true)
    const ok = await verifyPin(value, settings.pin)
    const t = Date.now()
    await setSetting('pinLockState', nextPinLockState(lock, ok, t))
    setChecking(false)
    setNow(t)
    if (ok) return onUnlock()
    setError(true)
    setPin('')
    dots.current?.classList.remove('is-shake')
    void dots.current?.offsetWidth
    dots.current?.classList.add('is-shake')
  }

  const onKey = (k: KeypadKey) => {
    if (checking || remaining > 0) return
    if (k === 'back') return setPin((p) => p.slice(0, -1))
    if (k === '000') return
    setError(false)
    const next = (pin + k).slice(0, PIN_LENGTH)
    setPin(next)
    if (next.length === PIN_LENGTH) void submit(next)
  }

  const secs = Math.ceil(remaining / 1000)
  return (
    <div className="s-lock">
      <div className="s-lock__top">
        <ArusMark size={40} className="s-lock__mark" />
        <p className="s-lock__title">Masukkan PIN</p>
        <div ref={dots} className="s-pin-dots" aria-label={`${pin.length} dari ${PIN_LENGTH} digit`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={cx('s-pin-dot', i < pin.length && 'is-filled')} />
          ))}
        </div>
        <p className={cx('s-lock__msg', (error || remaining > 0) && 'is-error')} aria-live="polite">
          {remaining > 0
            ? `Terlalu banyak percobaan. Coba lagi dalam ${secs >= 60 ? `${Math.ceil(secs / 60)} menit` : `${secs} detik`}.`
            : error
              ? 'PIN salah'
              : ' '}
        </p>
      </div>
      <div className="s-lock__pad">
        <Keypad value={0} onChange={() => {}} variant="pin" onKey={onKey} disabled={remaining > 0} captureKeyboard />
        <button type="button" className="s-lock__forgot" onClick={() => setForgot(true)}>
          Lupa PIN?
        </button>
      </div>
      <TypeToConfirmSheet
        open={forgot}
        onClose={() => setForgot(false)}
        title="Lupa PIN"
        message="PIN tidak bisa dipulihkan. Satu-satunya jalan adalah menghapus semua data di perangkat ini, lalu memulihkan dari file backup."
        confirmLabel="Hapus semua data"
        onConfirm={async () => {
          await resetAllData()
          setForgot(false)
          navigate('/', { replace: true })
          onUnlock()
        }}
      />
    </div>
  )
}
