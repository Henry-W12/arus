/* Detail akun (PRD §3.6): saldo, aksi, riwayat dengan saldo berjalan. */
import { useState } from 'react'
import { unarchiveAccount } from '../db/repo'
import { formatDateMedium, toLocalDate } from '../lib/dates'
import { useAccountDetail, useAccounts, useLookup, useToday } from '../lib/hooks'
import { formatIDR } from '../lib/money'
import { AmountText, CategoryIcon, EmptyState, Icon, Screen, useRouter, useSheet, useToast, type IconName } from '../ui'
import { AccountSheet, AdjustSheet } from './AccountSheet'
import { Banner, DayList, accountTypeLabel, useDeleteTx, useHighlightReset } from './shared'

export function AccountDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const sheet = useSheet()
  const toast = useToast()
  const today = useToday()
  const detail = useAccountDetail(id)
  const lookup = useLookup()
  const active = useAccounts()
  const onDelete = useDeleteTx()
  const [edit, setEdit] = useState(false)
  const [adjust, setAdjust] = useState(false)
  useHighlightReset()

  const back = { label: 'Akun', onBack: () => router.back('/akun') }
  if (detail === null) {
    return (
      <Screen title="Akun" large={false} back={back}>
        <EmptyState icon="wallet" title="Akun tidak ditemukan" />
      </Screen>
    )
  }
  if (!detail || !lookup || !active) return <Screen title="" large={false} back={back}>{null}</Screen>
  const { account, balance, scheduledBalance, groups, running } = detail
  const archived = account.archived === 1

  return (
    <Screen title={account.name} large={false} back={back} actions={<button type="button" className="s-sheet-btn s-nav-text" onClick={() => setEdit(true)}>Ubah</button>}>
      <div className="s-acct-hero">
        <CategoryIcon icon={account.icon} color={archived ? 'neutral' : account.color} size={56} />
        <h1 className="s-acct-hero__name">{account.name}</h1>
        <p className="s-acct-hero__type">
          {accountTypeLabel(account.type)}
          {!account.includeInTotal && ' · tidak dihitung ke total'}
        </p>
        <AmountText value={balance} kind="balance" size="hero" className="s-acct-hero__bal" />
        <p className="s-acct-hero__meta num">
          Saldo awal {formatIDR(account.openingBalance)} · dibuat {formatDateMedium(toLocalDate(new Date(account.createdAt)))}
        </p>
        {scheduledBalance !== balance && <p className="s-acct-hero__meta num">Saldo setelah terjadwal: {formatIDR(scheduledBalance)}</p>}
      </div>

      {archived ? (
        <div className="s-banner-wrap">
          <Banner
            icon="archive"
            action={{
              label: 'Pulihkan',
              onClick: async () => {
                await unarchiveAccount(account.id)
                toast.show({ message: 'Akun dipulihkan' })
              },
            }}
          >
            Akun ini diarsipkan. Riwayatnya tetap tersimpan, tetapi tidak dihitung ke total saldo.
          </Banner>
        </div>
      ) : (
        <div className="s-acct-actions">
          <ActionTile icon="scale" label="Sesuaikan" onClick={() => setAdjust(true)} />
          <ActionTile icon="arrows-swap" label="Transfer" disabled={active.length < 2} onClick={() => sheet.open('add', { mode: 'transfer', from: account.id })} />
          <ActionTile icon="plus" label="Catat" onClick={() => sheet.open('add', { from: account.id })} />
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="list" title="Belum ada transaksi di akun ini" description="Transaksi dan transfer yang memakai akun ini akan muncul di sini, lengkap dengan saldo berjalan." />
      ) : (
        <DayList
          groups={groups}
          today={today}
          lookup={lookup}
          accountId={account.id}
          running={running}
          onOpen={(tx) => sheet.open('tx', { id: tx.id })}
          onDelete={onDelete}
        />
      )}

      <AccountSheet
        open={edit}
        onClose={() => setEdit(false)}
        account={account}
        balance={balance}
        activeCount={active.length}
        onDeleted={() => router.navigate('/akun', { replace: true })}
      />
      <AdjustSheet open={adjust} onClose={() => setAdjust(false)} account={account} balance={balance} />
    </Screen>
  )
}

function ActionTile({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="s-tile" onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  )
}
