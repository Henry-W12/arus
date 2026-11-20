/* Transaksi berulang (PRD §3.11, §5.3). */
import { useState } from 'react'
import {
  countFutureTransactionsOfRule,
  countMissedOccurrences,
  createRecurring,
  deleteRecurring,
  pauseRecurring,
  resumeRecurring,
  updateRecurring,
} from '../../db/repo'
import type { Frequency, ID, LocalDate, RecurringRule, RecurringType } from '../../db/schema'
import { formatDateMedium } from '../../lib/dates'
import { useAccounts, useCategories, useLookup, useRecurringRules, useToday } from '../../lib/hooks'
import { formatIDR } from '../../lib/money'
import { countDue, describeSchedule } from '../../lib/recurring'
import {
  ActionSheet,
  AmountText,
  BottomSheet,
  Button,
  CategoryIcon,
  ConfirmDialog,
  EmptyState,
  Icon,
  ListGroup,
  ListRow,
  Screen,
  SegmentedControl,
  Switch,
  TextField,
  useRouter,
  useToast,
} from '../../ui'
import {
  AccountPickerSheet,
  AmountSheet,
  CategoryPickerSheet,
  DatePickerSheet,
  ValueRow,
  errorMessage,
  shortDateLabel,
  useOpenSession,
} from '../shared'
import { appStore } from '../store'

const UNIT: Record<Frequency, string> = { daily: 'hari', weekly: 'minggu', monthly: 'bulan', yearly: 'tahun' }

export function RecurringScreen() {
  const router = useRouter()
  const rules = useRecurringRules()
  const lookup = useLookup()
  const [edit, setEdit] = useState<{ open: boolean; rule: RecurringRule | null }>({ open: false, rule: null })

  return (
    <Screen title="Berulang" back={{ label: 'Pengaturan', onBack: () => router.back('/pengaturan') }}>
      {rules && lookup && (
        <>
          {rules.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="Belum ada transaksi berulang"
              description="Catat kos, langganan, atau cicilan sekali, lalu Arus akan mencatatnya otomatis."
              action={{ label: 'Buat aturan', onClick: () => setEdit({ open: true, rule: null }) }}
            />
          ) : (
            <>
              <div className="s-gap" />
              <ListGroup>
                {rules.map((r) => {
                  const cat = r.categoryId ? lookup.categories.get(r.categoryId) : undefined
                  const from = lookup.accounts.get(r.accountId)?.name ?? ''
                  const to = r.toAccountId ? lookup.accounts.get(r.toAccountId)?.name : ''
                  const title = r.note || (r.type === 'transfer' ? `${from} → ${to}` : (cat?.name ?? ''))
                  return (
                    <ListRow
                      key={r.id}
                      leading={
                        <CategoryIcon
                          icon={r.type === 'transfer' ? 'arrows-swap' : (cat?.icon ?? 'dots')}
                          color={r.active ? (r.type === 'transfer' ? 'neutral' : (cat?.color ?? 'c12')) : 'neutral'}
                        />
                      }
                      title={title}
                      subtitle={describeSchedule(r)}
                      trailing={<AmountText value={r.amount} kind={r.type === 'transfer' ? 'transfer' : r.type} muted={!r.active} />}
                      trailingSub={r.active ? formatDateMedium(r.nextDate).replace(/ \d{4}$/, '') : 'Dijeda'}
                      onClick={() => setEdit({ open: true, rule: r })}
                    />
                  )
                })}
                <ValueRow title="Aturan baru" tone="accent" icon={{ name: 'plus', color: 'neutral' }} chevron={false} onClick={() => setEdit({ open: true, rule: null })} />
              </ListGroup>
              <p className="s-footnote">Transaksi dibuat otomatis saat jatuh tempo (saat app dibuka). Mengubah aturan tidak mengubah transaksi yang sudah tercatat.</p>
            </>
          )}
        </>
      )}
      <RuleSheet open={edit.open} onClose={() => setEdit((e) => ({ ...e, open: false }))} rule={edit.rule} />
    </Screen>
  )
}

function RuleSheet(props: { open: boolean; onClose: () => void; rule: RecurringRule | null }) {
  const session = useOpenSession(props.open)
  return <RuleSheetInner key={session} {...props} />
}

type Sub = 'amount' | 'cat' | 'acc' | 'to' | 'start' | 'end' | null

function RuleSheetInner({ open, onClose, rule }: { open: boolean; onClose: () => void; rule: RecurringRule | null }) {
  const toast = useToast()
  const today = useToday()
  const lookup = useLookup()
  const accounts = useAccounts()
  const [type, setType] = useState<RecurringType>(rule?.type ?? 'expense')
  const cats = useCategories(type === 'transfer' ? undefined : type)
  const [amount, setAmount] = useState(rule?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<ID | null>(rule?.categoryId ?? null)
  const [accountId, setAccountId] = useState<ID | null>(rule?.accountId ?? accounts?.[0]?.id ?? null)
  const [toAccountId, setToAccountId] = useState<ID | null>(rule?.toAccountId ?? null)
  const [note, setNote] = useState(rule?.note ?? '')
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly')
  const [interval, setEvery] = useState(rule?.interval ?? 1)
  const [anchor, setAnchor] = useState<LocalDate>(rule?.anchorDate ?? today)
  const [endDate, setEndDate] = useState<LocalDate | null>(rule?.endDate ?? null)
  const [active, setActive] = useState(rule ? rule.active === 1 : true)
  const [sub, setSub] = useState<Sub>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDue, setConfirmDue] = useState<number | null>(null)
  const [resume, setResume] = useState<number | null>(null)
  const [del, setDel] = useState<number | null>(null)

  const acc = accountId ? lookup?.accounts.get(accountId) : undefined
  const toAcc = toAccountId ? lookup?.accounts.get(toAccountId) : undefined
  const cat = categoryId ? lookup?.categories.get(categoryId) : undefined
  const effAccount = acc ?? (accounts?.[0] ? lookup?.accounts.get(accounts[0].id) : undefined)
  const valid =
    amount > 0 && !!effAccount && (type === 'transfer' ? !!toAccountId && toAccountId !== effAccount.id : !!categoryId) && (!endDate || endDate >= anchor)
  const scheduleChanged = !!rule && (rule.anchorDate !== anchor || rule.frequency !== frequency || rule.interval !== interval)
  const schedule = { frequency, interval, anchorDate: anchor, endDate: endDate ?? undefined }

  const data = () => ({
    type,
    amount,
    accountId: effAccount!.id,
    toAccountId: type === 'transfer' ? toAccountId! : undefined,
    categoryId: type === 'transfer' ? undefined : categoryId!,
    note: note.trim() || undefined,
    frequency,
    interval,
    anchorDate: anchor,
    endDate: endDate ?? undefined,
  })

  const commit = async () => {
    setConfirmDue(null)
    setError(null)
    try {
      const { run } = rule ? await updateRecurring(rule.id, data(), today) : await createRecurring(data(), today)
      if (run.created) appStore.noteRecurring(run.created, run.since)
      toast.show({ message: rule ? 'Aturan disimpan' : run.created ? `Aturan dibuat · ${run.created} transaksi dicatat` : 'Aturan dibuat' })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const save = () => {
    if (!valid) return
    if (!rule || scheduleChanged) {
      const n = countDue({ ...schedule, generatedCount: 0 }, today)
      if (n > 1 || (n === 1 && anchor < today)) return setConfirmDue(n)
    }
    void commit()
  }

  const toggleActive = async (on: boolean) => {
    if (!rule) return setActive(on)
    try {
      if (!on) {
        await pauseRecurring(rule.id)
        setActive(false)
        toast.show({ message: 'Aturan dijeda' })
        return
      }
      const missed = await countMissedOccurrences(rule.id, today)
      if (missed > 0) return setResume(missed)
      await resumeRecurring(rule.id, 'skip', today)
      setActive(true)
      toast.show({ message: 'Aturan aktif lagi' })
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const doResume = async (mode: 'catch-up' | 'skip') => {
    if (!rule) return
    setResume(null)
    try {
      const r = await resumeRecurring(rule.id, mode, today)
      if (r.created) appStore.noteRecurring(r.created, r.since)
      setActive(true)
      toast.show({ message: mode === 'catch-up' ? `${r.created} transaksi dicatat` : 'Aturan aktif lagi' })
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const askDelete = async () => {
    if (!rule) return
    setDel(await countFutureTransactionsOfRule(rule.id, today))
  }
  const doDelete = async (deleteFuture: boolean) => {
    if (!rule) return
    setDel(null)
    await deleteRecurring(rule.id, { deleteFuture, today })
    toast.show({ message: 'Aturan dihapus' })
    onClose()
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        detent="full"
        title={rule ? 'Ubah aturan' : 'Aturan baru'}
        headerLeft={
          <button type="button" className="s-sheet-btn" onClick={onClose}>
            Batal
          </button>
        }
        headerRight={
          <button type="button" className="s-sheet-btn is-strong" disabled={!valid} onClick={save}>
            Simpan
          </button>
        }
      >
        <div className="s-form">
          <SegmentedControl
            ariaLabel="Jenis"
            value={type}
            onChange={(t) => {
              setType(t)
              setCategoryId(null)
            }}
            options={[
              { value: 'expense', label: 'Keluar' },
              { value: 'income', label: 'Masuk' },
              { value: 'transfer', label: 'Transfer', disabled: (accounts?.length ?? 0) < 2 },
            ]}
          />
          <p className="s-form__label">Nominal</p>
          <button type="button" className="s-picker" onClick={() => setSub('amount')}>
            <span className={amount ? 's-picker__value num' : 's-picker__value is-placeholder'}>{amount ? formatIDR(amount) : 'Atur nominal'}</span>
            <Icon name="chevron-right" size={17} />
          </button>
          {type !== 'transfer' && (
            <>
              <p className="s-form__label">Kategori</p>
              <button type="button" className="s-picker" onClick={() => setSub('cat')}>
                {cat && <CategoryIcon icon={cat.icon} color={cat.color} />}
                <span className={cat ? 's-picker__value' : 's-picker__value is-placeholder'}>{cat?.name ?? 'Pilih kategori'}</span>
                <Icon name="chevron-right" size={17} />
              </button>
            </>
          )}
          <div className="s-form__row">
            <div>
              <p className="s-form__label s-form__label--block">{type === 'transfer' ? 'Dari' : 'Akun'}</p>
              <button type="button" className="s-picker" onClick={() => setSub('acc')}>
                <span className="s-picker__value">{effAccount?.name ?? 'Pilih akun'}</span>
                <Icon name="chevron-down" size={17} />
              </button>
            </div>
            {type === 'transfer' && (
              <div>
                <p className="s-form__label s-form__label--block">Ke</p>
                <button type="button" className="s-picker" onClick={() => setSub('to')}>
                  <span className={toAcc ? 's-picker__value' : 's-picker__value is-placeholder'}>{toAcc?.name ?? 'Pilih akun'}</span>
                  <Icon name="chevron-down" size={17} />
                </button>
              </div>
            )}
          </div>
          <TextField label="Catatan" value={note} onChange={(v) => setNote(v.slice(0, 120))} placeholder="mis. Kos, Netflix, Cicilan motor" autoComplete="off" />

          <p className="s-form__label">Frekuensi</p>
          <SegmentedControl
            ariaLabel="Frekuensi"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: 'daily', label: 'Harian' },
              { value: 'weekly', label: 'Mingguan' },
              { value: 'monthly', label: 'Bulanan' },
              { value: 'yearly', label: 'Tahunan' },
            ]}
          />
          <div className="s-stepper">
            <span>
              Setiap <strong className="num">{interval}</strong> {UNIT[frequency]}
            </span>
            <span className="s-stepper__btns">
              <button type="button" aria-label="Kurangi" disabled={interval <= 1} onClick={() => setEvery((i) => Math.max(1, i - 1))}>
                <Icon name="minus" size={18} strokeWidth={2} />
              </button>
              <button type="button" aria-label="Tambah" disabled={interval >= 12} onClick={() => setEvery((i) => Math.min(12, i + 1))}>
                <Icon name="plus" size={18} strokeWidth={2} />
              </button>
            </span>
          </div>
          <div className="s-form__row">
            <div>
              <p className="s-form__label s-form__label--block">Mulai</p>
              <button type="button" className="s-picker" onClick={() => setSub('start')}>
                <Icon name="calendar" size={18} />
                <span className="s-picker__value">{formatDateMedium(anchor)}</span>
              </button>
            </div>
            <div>
              <p className="s-form__label s-form__label--block">Berakhir</p>
              <button type="button" className="s-picker" onClick={() => setSub('end')}>
                <Icon name="calendar" size={18} />
                <span className={endDate ? 's-picker__value' : 's-picker__value is-placeholder'}>{endDate ? formatDateMedium(endDate) : 'Tidak pernah'}</span>
              </button>
            </div>
          </div>
          {endDate && (
            <button type="button" className="s-link" onClick={() => setEndDate(null)}>
              Hapus tanggal berakhir
            </button>
          )}
          <p className="s-summary-line">
            {describeSchedule(schedule)[0].toUpperCase() + describeSchedule(schedule).slice(1)}
            {rule && rule.active === 1 && !scheduleChanged && ` · berikutnya ${shortDateLabel(rule.nextDate, today)}`}
          </p>
          {error && <p className="s-form__lead is-error">{error}</p>}
          {rule && (
            <div className="s-switch-card">
              <Switch label="Aktif" checked={active} onChange={(v) => void toggleActive(v)} />
              <p className="s-form__lead">Jeda untuk berhenti sementara tanpa menghapus aturan.</p>
            </div>
          )}
          {rule && (
            <Button variant="destructive" size="lg" block onClick={askDelete}>
              Hapus aturan
            </Button>
          )}
        </div>
      </BottomSheet>

      <AmountSheet
        open={sub === 'amount'}
        onClose={() => setSub(null)}
        title="Nominal"
        initial={amount}
        onSave={(v) => {
          setAmount(v)
          setSub(null)
        }}
      />
      <CategoryPickerSheet
        open={sub === 'cat'}
        onClose={() => setSub(null)}
        categories={cats ?? []}
        value={categoryId}
        onSelect={(id) => {
          setCategoryId(id)
          setSub(null)
        }}
      />
      <AccountPickerSheet
        open={sub === 'acc' || sub === 'to'}
        onClose={() => setSub(null)}
        title={sub === 'to' ? 'Ke akun' : 'Akun'}
        value={sub === 'to' ? toAccountId : effAccount?.id}
        exclude={sub === 'to' ? effAccount?.id : undefined}
        onSelect={(id) => {
          if (id) (sub === 'to' ? setToAccountId : setAccountId)(id)
          setSub(null)
        }}
      />
      <DatePickerSheet
        open={sub === 'start'}
        onClose={() => setSub(null)}
        title="Tanggal mulai"
        value={anchor}
        today={today}
        quick={false}
        onSelect={(d) => {
          setAnchor(d)
          if (endDate && endDate < d) setEndDate(null)
          setSub(null)
        }}
      />
      <DatePickerSheet
        open={sub === 'end'}
        onClose={() => setSub(null)}
        title="Berakhir pada"
        value={endDate ?? anchor}
        today={today}
        quick={false}
        max={'2099-12-31'}
        onSelect={(d) => {
          setEndDate(d < anchor ? anchor : d)
          setSub(null)
        }}
      />
      <ConfirmDialog
        open={confirmDue !== null}
        title={`Akan mencatat ${confirmDue} transaksi sejak ${formatDateMedium(anchor)}`}
        message="Kejadian yang sudah lewat dicatat dengan tanggal aslinya."
        confirmLabel="Simpan dan catat"
        destructive={false}
        onConfirm={() => void commit()}
        onCancel={() => setConfirmDue(null)}
      />
      <ActionSheet
        open={resume !== null}
        title="Aktifkan lagi"
        message={`Ada ${resume} kejadian yang terlewat selama dijeda.`}
        options={[
          { label: `Catat yang terlewat (${resume})`, onSelect: () => void doResume('catch-up') },
          { label: 'Lewati, mulai dari kejadian berikutnya', onSelect: () => void doResume('skip') },
        ]}
        onCancel={() => setResume(null)}
      />
      <ActionSheet
        open={del !== null}
        title="Hapus aturan?"
        message="Transaksi yang sudah dicatat tetap ada."
        options={[
          { label: 'Hapus aturan', destructive: true, onSelect: () => void doDelete(false) },
          ...(del ? [{ label: `Hapus aturan + ${del} transaksi terjadwal`, destructive: true, onSelect: () => void doDelete(true) }] : []),
        ]}
        onCancel={() => setDel(null)}
      />
    </>
  )
}
