/* Sheet akun baru/edit + sesuaikan saldo (PRD §3.6). */
import { useState } from 'react'
import {
  adjustBalance,
  archiveAccount,
  canDeleteAccount,
  countActiveRulesForAccount,
  createAccount,
  deleteAccount,
  unarchiveAccount,
  updateAccount,
} from '../db/repo'
import { ACCOUNT_ICON_IDS } from '../db/iconIds'
import { ACCOUNT_NAME_MAX, type Account, type AccountType, type ColorToken, type IconName } from '../db/schema'
import { formatIDR } from '../lib/money'
import { BottomSheet, Button, ConfirmDialog, SegmentedControl, Switch, TextField, useToast } from '../ui'
import { AmountSheet, ColorGrid, IconGrid, errorMessage, useOpenSession } from './shared'

const TYPES: { value: AccountType; label: string; icon: IconName }[] = [
  { value: 'cash', label: 'Tunai', icon: 'cash' },
  { value: 'bank', label: 'Bank', icon: 'bank' },
  { value: 'ewallet', label: 'E-wallet', icon: 'smartphone-wallet' },
  { value: 'other', label: 'Lainnya', icon: 'wallet' },
]

export function AccountSheet({
  open,
  onClose,
  account,
  balance,
  activeCount,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  account: Account | null
  balance?: number
  activeCount: number
  onDeleted?: () => void
}) {
  const session = useOpenSession(open)
  return <AccountSheetInner key={session} {...{ open, onClose, account, balance, activeCount, onDeleted }} />
}

function AccountSheetInner({
  open,
  onClose,
  account,
  balance,
  activeCount,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  account: Account | null
  balance?: number
  activeCount: number
  onDeleted?: () => void
}) {
  const toast = useToast()
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const [icon, setIcon] = useState<IconName>(account?.icon ?? 'bank')
  const [color, setColor] = useState<ColorToken>(account?.color ?? 'c2')
  const [opening, setOpening] = useState(account?.openingBalance ?? 0)
  const [include, setInclude] = useState(account ? account.includeInTotal === 1 : true)
  const [error, setError] = useState<string | null>(null)
  const [amountOpen, setAmountOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | { kind: 'archive' | 'delete'; message: string }>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = { name: name.trim(), type, icon, color, openingBalance: opening, includeInTotal: include ? (1 as const) : (0 as const) }
      if (account) await updateAccount(account.id, data)
      else await createAccount(data)
      toast.show({ message: account ? 'Akun disimpan' : `Akun ${data.name} dibuat` })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const askRemove = async () => {
    if (!account) return
    if (await canDeleteAccount(account.id)) {
      setConfirm({ kind: 'delete', message: 'Akun ini belum punya transaksi dan akan dihapus permanen.' })
      return
    }
    const rules = await countActiveRulesForAccount(account.id)
    const parts = ['Riwayat tetap tersimpan, tetapi akun hilang dari pilihan dan total saldo.']
    if (balance) parts.push(`Saldo masih ${formatIDR(balance)}; sebaiknya sesuaikan ke 0 dulu.`)
    if (rules) parts.push(`${rules} transaksi berulang yang memakai akun ini akan dinonaktifkan.`)
    setConfirm({ kind: 'archive', message: parts.join(' ') })
  }
  const doRemove = async () => {
    if (!account || !confirm) return
    try {
      if (confirm.kind === 'delete') {
        await deleteAccount(account.id)
        toast.show({ message: 'Akun dihapus' })
        onDeleted?.()
      } else {
        await archiveAccount(account.id)
        toast.show({ message: 'Akun diarsipkan' })
      }
      setConfirm(null)
      onClose()
    } catch (e) {
      setConfirm(null)
      setError(errorMessage(e))
    }
  }

  const lastActive = !!account && account.archived === 0 && activeCount <= 1
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        detent="full"
        title={account ? 'Ubah akun' : 'Akun baru'}
        headerLeft={
          <button type="button" className="s-sheet-btn" onClick={onClose}>
            Batal
          </button>
        }
        headerRight={
          <button type="button" className="s-sheet-btn is-strong" disabled={!name.trim() || busy} onClick={save}>
            Simpan
          </button>
        }
      >
        <div className="s-form">
          <TextField
            label="Nama"
            value={name}
            onChange={(v) => setName(v.slice(0, ACCOUNT_NAME_MAX))}
            placeholder="mis. BCA, GoPay, Dompet"
            error={error ?? undefined}
            autoComplete="off"
          />
          <p className="s-form__label">Jenis</p>
          <SegmentedControl
            ariaLabel="Jenis akun"
            value={type}
            onChange={(t) => {
              if (icon === TYPES.find((x) => x.value === type)?.icon) setIcon(TYPES.find((x) => x.value === t)!.icon)
              setType(t)
            }}
            options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
          <p className="s-form__label">Saldo awal</p>
          <button type="button" className="s-picker" onClick={() => setAmountOpen(true)}>
            <span className="s-picker__value num">{formatIDR(opening)}</span>
            <span className="ink-3 t-footnote">Ubah</span>
          </button>
          <div className="s-switch-card">
            <Switch label="Hitung ke total saldo" checked={include} onChange={setInclude} />
            <p className="s-form__lead">Matikan untuk tabungan atau utang yang tidak ingin ikut dijumlah.</p>
          </div>
          <p className="s-form__label">Ikon</p>
          <IconGrid icons={ACCOUNT_ICON_IDS as readonly IconName[]} value={icon} color={color} onChange={setIcon} />
          <p className="s-form__label">Warna</p>
          <ColorGrid value={color} onChange={setColor} />
          {account && account.archived === 1 && (
            <Button
              variant="secondary"
              size="lg"
              block
              onClick={async () => {
                await unarchiveAccount(account.id)
                toast.show({ message: 'Akun dipulihkan' })
                onClose()
              }}
            >
              Pulihkan akun
            </Button>
          )}
          {account && account.archived === 0 && (
            <Button variant="destructive" size="lg" block disabled={lastActive} onClick={askRemove}>
              Arsipkan atau hapus akun
            </Button>
          )}
          {lastActive && <p className="s-form__lead">Minimal satu akun harus aktif.</p>}
        </div>
      </BottomSheet>
      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title="Saldo awal"
        initial={opening}
        allowNegative
        allowZero
        info={() => 'Saldo sebelum transaksi pertama dicatat di Arus.'}
        onSave={(v) => {
          setOpening(v)
          setAmountOpen(false)
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'delete' ? 'Hapus akun?' : 'Arsipkan akun?'}
        message={confirm?.message}
        confirmLabel={confirm?.kind === 'delete' ? 'Hapus akun' : 'Arsipkan akun'}
        onConfirm={doRemove}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}

export function AdjustSheet({ open, onClose, account, balance }: { open: boolean; onClose: () => void; account: Account | null; balance: number }) {
  const toast = useToast()
  return (
    <AmountSheet
      open={open}
      onClose={onClose}
      title="Sesuaikan saldo"
      initial={balance}
      allowNegative
      allowZero
      canSave={(v) => v !== balance}
      info={(v) => {
        const d = v - balance
        if (d === 0) return `Saldo di Arus ${formatIDR(balance)}. Ketik saldo nyata ${account?.name ?? ''}.`
        return (
          <>
            Akan mencatat penyesuaian <strong className={d > 0 ? 'ink-pos' : 'ink'}>{formatIDR(d, 'always')}</strong>
          </>
        )
      }}
      saveLabel="Catat penyesuaian"
      onSave={async (v) => {
        if (!account) return
        try {
          await adjustBalance(account.id, v)
          toast.show({ message: 'Saldo disesuaikan' })
          onClose()
        } catch (e) {
          toast.show({ message: errorMessage(e), tone: 'error' })
        }
      }}
    />
  )
}
