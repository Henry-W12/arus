/* Tab Transaksi (PRD §3.1). */
import { useMemo, useState } from 'react'
import { createBackupFile, markBackupDone } from '../db/backup'
import { setSetting } from '../db/repo'
import { diffDays } from '../lib/dates'
import { useAllTransactions, useBackupReminder, useBalances, useCurrentPeriod, useLookup, useSettings, useToday } from '../lib/hooks'
import { periodLength } from '../lib/period'
import { isStandalone, shareOrDownloadFile, snoozeBackupReminder } from '../lib/storage'
import { effectiveOnly } from '../lib/effective'
import { groupByDay, periodTotals } from '../lib/summary'
import { AmountText, EmptyState, IconButton, Screen, useRouter, useSheet, useToast } from '../ui'
import { Banner, DayList, errorMessage, useDeleteTx, useHighlightReset } from './shared'
import { appStore, useAppStore } from './store'

const WEEK = 7 * 24 * 3600 * 1000

export function TransactionsScreen() {
  const { navigate } = useRouter()
  const sheet = useSheet()
  const today = useToday()
  const settings = useSettings()
  const bal = useBalances()
  const txs = useAllTransactions()
  const lookup = useLookup()
  const period = useCurrentPeriod()
  const remind = useBackupReminder()
  const notice = useAppStore((s) => s.recurringNotice)
  const onDelete = useDeleteTx()
  const toast = useToast()
  const [installHidden, setInstallHidden] = useState(false)
  useHighlightReset()

  const groups = useMemo(() => (txs ? groupByDay(txs) : undefined), [txs])
  const totals = useMemo(
    () => (txs && period ? periodTotals(effectiveOnly(txs, today), period) : undefined),
    [txs, period, today],
  )
  const progress = period ? Math.min(1, (diffDays(period.start, today) + 1) / periodLength(period)) : 0

  const showInstall =
    !!settings &&
    !installHidden &&
    !isStandalone() &&
    (settings.installHintDismissedAt === null || Date.now() - settings.installHintDismissedAt > WEEK)

  const backupNow = async () => {
    try {
      const outcome = await shareOrDownloadFile(await createBackupFile())
      if (outcome !== 'cancelled') {
        await markBackupDone()
        toast.show({ message: 'Backup dibuat' })
      }
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    }
  }

  let banner = null
  if (showInstall) {
    banner = (
      <Banner
        icon="share"
        onClose={() => {
          setInstallHidden(true)
          void setSetting('installHintDismissedAt', Date.now())
        }}
      >
        Pasang Arus ke Home Screen: tap Bagikan → Tambah ke Layar Utama. Data di Safari dan di app Home Screen terpisah.
      </Banner>
    )
  } else if (remind) {
    banner = (
      <Banner icon="alert" tone="warning" action={{ label: 'Backup sekarang', onClick: backupNow }} secondary={{ label: 'Nanti', onClick: () => void snoozeBackupReminder() }}>
        Sudah lama sejak backup terakhir. Simpan salinan data ke Files agar aman.
      </Banner>
    )
  } else if (notice) {
    banner = (
      <Banner
        icon="repeat"
        action={{
          label: 'Lihat',
          onClick: () => {
            navigate(`/cari?recurring=1&since=${notice.since}`)
            appStore.clearRecurring()
          },
        }}
        onClose={() => appStore.clearRecurring()}
      >
        {notice.count} transaksi berulang dicatat
      </Banner>
    )
  }

  const ready = groups && lookup && bal
  return (
    <Screen title="Transaksi" actions={<IconButton icon="search" label="Cari transaksi" onClick={() => navigate('/cari')} />}>
      {/* Selama data dimuat, nilai disembunyikan (bukan "Rp 0" palsu, BUG-08); tata letak tetap. */}
      <button
        type="button"
        className={`s-hero${bal && totals ? '' : ' is-loading'}`}
        onClick={() => navigate('/akun')}
        aria-label="Total saldo, buka Akun"
        aria-busy={!(bal && totals)}
      >
        <span className="s-hero__label">Total saldo</span>
        <AmountText value={bal?.total ?? 0} kind="balance" size="amount-l" className="s-hero__value" />
        <span className="s-hero__line num">
          Bulan ini <AmountText value={totals?.expense ?? 0} kind="expense" size="inherit" className="ink" /> keluar ·{' '}
          <AmountText value={totals?.income ?? 0} kind="income" size="inherit" /> masuk
        </span>
        <span className="s-hero__period" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      </button>

      {banner && <div className="s-banner-wrap">{banner}</div>}

      {ready &&
        (groups.length === 0 ? (
          <EmptyState
            icon="list"
            title="Belum ada transaksi"
            description="Tap + untuk mencatat yang pertama. Biasanya cukup 4 tap."
            action={{ label: 'Catat transaksi', onClick: () => sheet.open('add') }}
          />
        ) : (
          <DayList groups={groups} today={today} lookup={lookup} onOpen={(tx) => sheet.open('tx', { id: tx.id })} onDelete={onDelete} />
        ))}
    </Screen>
  )
}
