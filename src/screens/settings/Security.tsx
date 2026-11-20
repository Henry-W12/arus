/* Keamanan: PIN opsional (PRD §5.9). */
import { useRef, useState } from 'react'
import { setSetting, setSettings } from '../../db/repo'
import type { AutoLockMinutes } from '../../db/schema'
import { useSettings } from '../../lib/hooks'
import { hashPin, PIN_LENGTH, verifyPin } from '../../lib/pin'
import { BottomSheet, Button, Icon, Keypad, ListGroup, Screen, SegmentedControl, useRouter, useToast, type KeypadKey } from '../../ui'
import { GroupLabel, ValueRow, cx, useOpenSession } from '../shared'

type Flow = 'set' | 'change' | 'off'

export function SecurityScreen() {
  const router = useRouter()
  const settings = useSettings()
  const [flow, setFlow] = useState<{ open: boolean; kind: Flow }>({ open: false, kind: 'set' })
  const back = { label: 'Pengaturan', onBack: () => router.back('/pengaturan') }
  if (!settings) return <Screen title="Kunci PIN" back={back}>{null}</Screen>
  const on = !!settings.pin

  return (
    <Screen title="Kunci PIN" back={back}>
      <div className="s-card s-disclaimer">
        <Icon name="info" size={20} className="s-banner__icon" />
        <p>
          PIN hanya mengunci tampilan Arus. Data di perangkat tidak dienkripsi, dan file backup tidak dilindungi PIN. Jika lupa PIN, satu-satunya jalan adalah
          menghapus data lalu memulihkan dari backup.
        </p>
      </div>
      {on ? (
        <>
          <GroupLabel>PIN aktif</GroupLabel>
          <ListGroup>
            <ValueRow title="Ubah PIN" onClick={() => setFlow({ open: true, kind: 'change' })} />
            <ValueRow title="Matikan PIN" tone="negative" chevron={false} onClick={() => setFlow({ open: true, kind: 'off' })} />
          </ListGroup>
          <GroupLabel>Kunci otomatis</GroupLabel>
          <div className="s-seg-pad">
            <SegmentedControl<string>
              ariaLabel="Kunci otomatis"
              value={String(settings.autoLockMinutes)}
              onChange={(v) => void setSetting('autoLockMinutes', Number(v) as AutoLockMinutes)}
              options={[
                { value: '0', label: 'Segera' },
                { value: '1', label: '1 menit' },
                { value: '5', label: '5 menit' },
                { value: '15', label: '15 menit' },
              ]}
            />
          </div>
          <p className="s-footnote">Arus terkunci saat dibuka ulang dan saat kembali dari latar belakang setelah waktu ini.</p>
        </>
      ) : (
        <div className="s-pad">
          <Button size="lg" block icon="lock" onClick={() => setFlow({ open: true, kind: 'set' })}>
            Aktifkan PIN 6 digit
          </Button>
        </div>
      )}
      <PinFlowSheet open={flow.open} kind={flow.kind} onClose={() => setFlow((f) => ({ ...f, open: false }))} />
    </Screen>
  )
}

function PinFlowSheet(props: { open: boolean; kind: Flow; onClose: () => void }) {
  const session = useOpenSession(props.open)
  return <PinFlowInner key={session} {...props} />
}

function PinFlowInner({ open, kind, onClose }: { open: boolean; kind: Flow; onClose: () => void }) {
  const toast = useToast()
  const settings = useSettings()
  const steps: ('old' | 'new' | 'confirm')[] = kind === 'set' ? ['new', 'confirm'] : kind === 'change' ? ['old', 'new', 'confirm'] : ['old']
  const [step, setStep] = useState(0)
  const [pin, setPin] = useState('')
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dots = useRef<HTMLDivElement>(null)
  const cur = steps[step]
  const title = cur === 'old' ? 'Masukkan PIN sekarang' : cur === 'new' ? 'Buat PIN baru' : 'Ulangi PIN baru'

  const fail = (msg: string) => {
    setError(msg)
    setPin('')
    dots.current?.classList.remove('is-shake')
    void dots.current?.offsetWidth
    dots.current?.classList.add('is-shake')
  }
  const complete = async (value: string) => {
    setBusy(true)
    try {
      if (cur === 'old') {
        if (!settings?.pin || !(await verifyPin(value, settings.pin))) return fail('PIN salah')
        if (kind === 'off') {
          await setSettings({ pin: null, pinLockState: { failures: 0, lockedUntil: null } })
          toast.show({ message: 'PIN dimatikan' })
          return onClose()
        }
      } else if (cur === 'new') {
        setFirst(value)
      } else if (value !== first) {
        setStep(steps.indexOf('new'))
        setFirst('')
        return fail('PIN tidak sama. Ulangi dari awal.')
      } else {
        await setSettings({ pin: await hashPin(value), pinLockState: { failures: 0, lockedUntil: null } })
        toast.show({ message: kind === 'set' ? 'PIN aktif' : 'PIN diubah' })
        return onClose()
      }
      setError(null)
      setPin('')
      setStep((s) => s + 1)
    } finally {
      setBusy(false)
    }
  }
  const onKey = (k: KeypadKey) => {
    if (busy) return
    if (k === 'back') return setPin((p) => p.slice(0, -1))
    if (k === '000') return
    setError(null)
    const next = (pin + k).slice(0, PIN_LENGTH)
    setPin(next)
    if (next.length === PIN_LENGTH) void complete(next)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      detent="full"
      ariaLabel={title}
      headerLeft={
        <button type="button" className="s-sheet-btn" onClick={onClose}>
          Batal
        </button>
      }
      footer={<Keypad value={0} onChange={() => {}} variant="pin" onKey={onKey} captureKeyboard={open} onEscape={onClose} />}
    >
      <div className="s-pinflow">
        <Icon name="lock" size={32} className="s-pinflow__icon" />
        <p className="s-lock__title">{title}</p>
        <div ref={dots} className="s-pin-dots">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={cx('s-pin-dot', i < pin.length && 'is-filled')} />
          ))}
        </div>
        <p className={cx('s-lock__msg', error && 'is-error')} aria-live="polite">
          {error ?? (cur === 'new' ? 'Hindari tanggal lahir atau angka berurutan.' : ' ')}
        </p>
      </div>
    </BottomSheet>
  )
}
