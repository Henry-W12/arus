/* Data & Backup (PRD §3.8, §5.8). */
import { useEffect, useRef, useState } from 'react'
import { createBackupFile, createCsvFile, markBackupDone, previewRestore, restoreBackup, type RestorePreview } from '../../db/backup'
import { resetAllData, setSetting } from '../../db/repo'
import type { BackupReminderDays } from '../../db/schema'
import { parseBackup, type BackupFile } from '../../lib/backup'
import { formatDateMedium, toLocalDate } from '../../lib/dates'
import { useCurrentPeriod, useDataCounts, useSettings, useToday } from '../../lib/hooks'
import { formatNumber } from '../../lib/money'
import { describeLastBackup, ensurePersistentStorage, formatBytes, getStorageEstimate, shareOrDownloadFile } from '../../lib/storage'
import { ActionSheet, BottomSheet, Button, ListGroup, ListRow, Screen, SegmentedControl, useRouter, useToast } from '../../ui'
import { GroupLabel, TypeToConfirmSheet, ValueRow, cx, errorMessage } from '../shared'
import { appStore } from '../store'

export function DataScreen() {
  const router = useRouter()
  const toast = useToast()
  const settings = useSettings()
  const counts = useDataCounts()
  const period = useCurrentPeriod()
  const today = useToday()
  const [usage, setUsage] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [restore, setRestore] = useState<{ open: boolean; backup: BackupFile | null; preview: RestorePreview | null }>({ open: false, backup: null, preview: null })
  const [wipe, setWipe] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getStorageEstimate().then((e) => setUsage(e ? formatBytes(e.usage) : null))
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [counts?.transactions])

  if (!settings || !counts) return <Screen title="Data & Backup" back={{ label: 'Pengaturan', onBack: () => router.back('/pengaturan') }}>{null}</Screen>

  const persistOn = persisted ?? settings.persistGranted
  const backup = async () => {
    setBusy(true)
    try {
      const outcome = await shareOrDownloadFile(await createBackupFile())
      if (outcome !== 'cancelled') {
        await markBackupDone()
        toast.show({ message: 'Backup dibuat' })
      }
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const exportCsv = async (kind: 'all' | 'period' | 'year') => {
    setCsvOpen(false)
    try {
      const y = today.slice(0, 4)
      const file =
        kind === 'all'
          ? await createCsvFile({ kind: 'all' })
          : kind === 'period' && period
            ? await createCsvFile({ kind: 'range', from: period.start, to: period.end, label: period.key })
            : await createCsvFile({ kind: 'range', from: `${y}-01-01`, to: `${y}-12-31`, label: y })
      await shareOrDownloadFile(file)
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    }
  }
  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = parseBackup(await file.text())
      if (!res.ok) {
        toast.show({ message: res.message, tone: 'error', duration: 8000 })
        return
      }
      setRestore({ open: true, backup: res.backup, preview: await previewRestore(res.backup) })
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const doRestore = async () => {
    if (!restore.backup) return
    setBusy(true)
    try {
      const run = await restoreBackup(restore.backup)
      appStore.noteRecurring(run.created, run.since)
      setRestore((r) => ({ ...r, open: false }))
      toast.show({ message: 'Data dipulihkan' })
      router.navigate('/', { replace: true })
    } catch (e) {
      toast.show({ message: `Gagal memulihkan, data lama tetap utuh. ${errorMessage(e)}`, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const neverBackedUp = settings.lastBackupAt === null
  return (
    <Screen title="Data & Backup" back={{ label: 'Pengaturan', onBack: () => router.back('/pengaturan') }}>
      <div className="s-card s-backup-card">
        <div className="s-backup-card__row">
          <span className="s-stats__label">Backup terakhir</span>
          <span className={cx('s-backup-card__value', neverBackedUp && 'is-warning-text')}>{describeLastBackup(settings.lastBackupAt)}</span>
        </div>
        <p className="s-backup-card__meta num">
          {formatNumber(counts.transactions)} transaksi · {counts.accounts} akun · {counts.categories} kategori
        </p>
        <Button size="lg" block icon="share" disabled={busy} onClick={backup}>
          Buat backup (JSON)
        </Button>
        <p className="s-backup-card__hint">Simpan file ke Files atau iCloud Drive. File ini satu-satunya cara memindahkan data ke iPhone lain.</p>
      </div>

      <GroupLabel>Penyimpanan</GroupLabel>
      <ListGroup>
        <ListRow
          title="Penyimpanan permanen"
          trailing={<span className={persistOn ? 'ink-pos' : 'is-warning-text'}>{persistOn ? 'Aktif' : persistOn === false ? 'Tidak aktif' : 'Tidak diketahui'}</span>}
        />
        {usage && <ListRow title="Terpakai" trailing={<span className="ink-2">{usage}</span>} />}
        {!persistOn && (
          <ValueRow
            title="Minta penyimpanan permanen"
            tone="accent"
            chevron={false}
            onClick={async () => {
              const ok = await ensurePersistentStorage()
              setPersisted(ok)
              toast.show({ message: ok ? 'Penyimpanan permanen aktif' : 'Belum diizinkan. Pasang Arus ke Home Screen agar lebih aman.' })
            }}
          />
        )}
      </ListGroup>
      <p className="s-footnote">Tanpa penyimpanan permanen, iOS bisa menghapus data situs yang jarang dibuka. Pengingat backup diperketat menjadi 7 hari.</p>

      <GroupLabel>Ekspor & pulihkan</GroupLabel>
      <ListGroup>
        <ValueRow icon={{ name: 'download', color: 'c8' }} title="Ekspor CSV" onClick={() => setCsvOpen(true)} />
        <ValueRow icon={{ name: 'upload', color: 'c2' }} title="Pulihkan dari backup" onClick={() => fileRef.current?.click()} />
      </ListGroup>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void pickFile(e.target.files?.[0])} />
      <p className="s-footnote">CSV untuk dibuka di Numbers atau Excel, bukan pengganti backup.</p>

      <GroupLabel>Pengingat backup</GroupLabel>
      <div className="s-seg-pad">
        <SegmentedControl<string>
          ariaLabel="Pengingat backup"
          value={String(settings.backupReminderDays)}
          onChange={(v) => void setSetting('backupReminderDays', Number(v) as BackupReminderDays)}
          options={[
            { value: '0', label: 'Mati' },
            { value: '7', label: '7 hari' },
            { value: '14', label: '14 hari' },
            { value: '30', label: '30 hari' },
          ]}
        />
      </div>

      <GroupLabel>Zona berbahaya</GroupLabel>
      <ListGroup>
        <ValueRow title="Hapus semua data" tone="negative" chevron={false} onClick={() => setWipe(true)} />
      </ListGroup>
      <p className="s-footnote">Menghapus semua transaksi, akun, kategori, dan pengaturan di perangkat ini, lalu memulai dari awal.</p>

      <ActionSheet
        open={csvOpen}
        title="Ekspor CSV"
        options={[
          { label: 'Semua transaksi', onSelect: () => void exportCsv('all') },
          { label: 'Periode ini', onSelect: () => void exportCsv('period') },
          { label: 'Tahun ini', onSelect: () => void exportCsv('year') },
        ]}
        onCancel={() => setCsvOpen(false)}
      />
      <BottomSheet open={restore.open} onClose={() => setRestore((r) => ({ ...r, open: false }))} title="Pulihkan dari backup" detent="auto">
        {restore.preview && (
          <div className="s-form">
            <div className="s-restore">
              <p className="s-restore__title">Backup {formatDateMedium(toLocalDate(new Date(restore.preview.exportedAt)))}</p>
              <p className="s-restore__meta num">
                {formatNumber(restore.preview.backup.transactions)} transaksi · {restore.preview.backup.accounts} akun · {restore.preview.backup.categories} kategori
              </p>
            </div>
            <p className="s-form__lead">
              <strong className="ink">Semua data saat ini ({formatNumber(restore.preview.current.transactions)} transaksi) akan diganti.</strong> PIN di perangkat
              ini tetap dipakai.
            </p>
            <Button size="lg" block className="s-danger-btn" disabled={busy} onClick={doRestore}>
              Ganti data
            </Button>
            <Button size="lg" block variant="neutral" onClick={() => setRestore((r) => ({ ...r, open: false }))}>
              Batal
            </Button>
          </div>
        )}
      </BottomSheet>
      <TypeToConfirmSheet
        open={wipe}
        onClose={() => setWipe(false)}
        title="Hapus semua data"
        message="Tindakan ini tidak bisa dibatalkan. Buat backup dulu jika masih ingin menyimpan data."
        confirmLabel="Hapus semua data"
        onConfirm={async () => {
          await resetAllData()
          setWipe(false)
          toast.show({ message: 'Semua data dihapus' })
          router.navigate('/', { replace: true })
        }}
      />
    </Screen>
  )
}
