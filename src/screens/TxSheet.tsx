/*
 * Sheet input / edit transaksi (PRD §3.2, §4). Dibuka lewat ?sheet=add (mode=transfer opsional) atau ?sheet=tx&id=….
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import {
  addTransaction,
  addTransfer,
  applyTemplate,
  createRecurring,
  createTemplate,
  deleteRecurring,
  deleteTransaction,
  resolveDefaultAccountId,
  restoreTransaction,
  updateTransaction,
} from '../db/repo'
import type { Account, Category, Frequency, ID, LocalDate, Template, Transaction } from '../db/schema'
import { TEMPLATE_LABEL_MAX } from '../db/schema'
import { useAccounts, useCategories, useLookup, useRecentNotes, useSettings, useTemplates, useToday } from '../lib/hooks'
import { describeSchedule } from '../lib/recurring'
import {
  AmountDisplay,
  BottomSheet,
  CategoryCell,
  Chip,
  ConfirmDialog,
  Icon,
  IconButton,
  Keypad,
  SegmentedControl,
  TextField,
  useSheet,
  useToast,
  formatShort,
} from '../ui'
import {
  AccountPickerSheet,
  CategoryPickerSheet,
  ChoiceSheet,
  DatePickerSheet,
  cx,
  errorMessage,
  shortDateLabel,
  txToastLabel,
  useCompactHeight,
} from './shared'
import { appStore, useAppStore } from './store'

type Mode = 'expense' | 'income' | 'transfer'
type Sub = 'account' | 'to' | 'date' | 'note' | 'repeat' | 'cats' | null

export function TxSheet() {
  const { sheet, params } = useSheet()
  const open = sheet === 'add' || sheet === 'tx'
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((s) => s + 1)
  }
  const editId = sheet === 'tx' ? params.get('id') : null
  const startMode = params.get('mode') === 'transfer' ? 'transfer' : params.get('mode') === 'income' ? 'income' : 'expense'
  const fromAccount = params.get('from')
  if (session === 0) return null
  return <TxSheetLoader key={session} open={open} editId={editId} startMode={startMode} fromAccount={fromAccount} />
}

function TxSheetLoader({
  open,
  editId,
  startMode,
  fromAccount,
}: {
  open: boolean
  editId: ID | null
  startMode: Mode
  fromAccount: ID | null
}) {
  const settings = useSettings()
  const accounts = useAccounts()
  const categories = useCategories()
  const lookup = useLookup()
  const templates = useTemplates()
  const tx = useLiveQuery(async () => (editId ? ((await db.transactions.get(editId)) ?? null) : null), [editId])
  const { close } = useSheet()
  const [frozen, setFrozen] = useState<Transaction | null | undefined>(undefined)
  // Bekukan data awal transaksi yang diedit (live update tidak boleh menimpa form).
  if (frozen === undefined && tx !== undefined) setFrozen(tx)

  useEffect(() => {
    if (open && editId && tx === null && frozen === null) close()
  }, [open, editId, tx, frozen, close])

  if (!settings || !accounts || !categories || !lookup || !templates || (editId && !frozen)) return null
  const defaultAccount =
    (fromAccount && accounts.find((a) => a.id === fromAccount)?.id) || resolveDefaultAccountId(settings, accounts) || accounts[0]?.id
  return (
    <TxSheetBody
      open={open}
      tx={frozen ?? null}
      startMode={startMode}
      defaultAccount={defaultAccount}
      accounts={accounts}
      categories={categories}
      templates={templates}
      lookup={lookup}
    />
  )
}

interface BodyProps {
  open: boolean
  tx: Transaction | null
  startMode: Mode
  defaultAccount: ID
  accounts: Account[]
  categories: Category[]
  templates: Template[]
  lookup: NonNullable<ReturnType<typeof useLookup>>
}

const FREQ_LABEL: Record<Frequency, string> = { daily: 'Tiap hari', weekly: 'Tiap minggu', monthly: 'Tiap bulan', yearly: 'Tiap tahun' }

function TxSheetBody({ open, tx, startMode, defaultAccount, accounts, categories, templates, lookup }: BodyProps) {
  const today = useToday()
  const toast = useToast()
  const { close } = useSheet()
  const instant = useAppStore((s) => s.instantSheet)
  const isEdit = !!tx
  const isAdjust = tx?.type === 'adjustment'

  const [mode, setMode] = useState<Mode>(tx && tx.type !== 'adjustment' ? tx.type : startMode)
  const [amount, setAmount] = useState(tx ? Math.abs(tx.amount) : 0)
  const [categoryId, setCategoryId] = useState<ID | null>(tx?.categoryId ?? null)
  const [accountId, setAccountId] = useState<ID>(tx?.accountId ?? defaultAccount)
  const [toAccountId, setToAccountId] = useState<ID | null>(tx?.toAccountId ?? null)
  const [date, setDate] = useState<LocalDate>(tx?.date ?? today)
  const [note, setNote] = useState(tx?.note ?? '')
  const [repeat, setRepeat] = useState<Frequency | null>(null)
  const [sub, setSub] = useState<Sub>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const compact = useCompactHeight()

  useEffect(() => {
    appStore.setSheetBusy(open && amount > 0)
  }, [open, amount])
  useEffect(() => () => appStore.setSheetBusy(false), [])
  useEffect(() => {
    if (!open) appStore.setInstantSheet(false)
  }, [open])

  const kind = mode === 'transfer' ? null : mode
  const kindCats = useMemo(() => categories.filter((c) => c.kind === kind), [categories, kind])
  const lastCategory = useLiveQuery(async () => {
    if (!kind) return null
    const t = await db.transactions.orderBy('createdAt').reverse().filter((x) => x.type === kind).first()
    return t?.categoryId ?? null
  }, [kind])
  const activeAccounts = accounts.filter((a) => a.archived === 0)
  const account = lookup.accounts.get(accountId)
  const canTransfer = activeAccounts.length > 1

  const changed =
    isEdit &&
    (amount !== Math.abs(tx!.amount) ||
      (tx!.type !== 'adjustment' && mode !== tx!.type) ||
      (categoryId ?? undefined) !== tx!.categoryId ||
      accountId !== tx!.accountId ||
      (toAccountId ?? undefined) !== tx!.toAccountId ||
      date !== tx!.date ||
      (note.trim() || undefined) !== tx!.note)

  const transferIssue =
    mode === 'transfer' ? (!toAccountId ? 'Pilih akun tujuan' : toAccountId === accountId ? 'Pilih akun berbeda' : null) : null
  const valid = amount > 0 && (mode === 'transfer' ? !transferIssue : isAdjust || !!categoryId)

  const requestClose = () => {
    if (sub) return setSub(null)
    if (isEdit && changed) setConfirmDiscard(true)
    else close()
  }

  const switchMode = (m: Mode) => {
    if (m === mode) return
    setCategoryId(null)
    if (m === 'transfer' && !toAccountId) {
      const other = activeAccounts.find((a) => a.id !== accountId)
      setToAccountId(isEdit ? (other?.id ?? null) : null)
    }
    setMode(m)
  }

  const save = async (catOverride?: ID) => {
    const cat = catOverride ?? categoryId
    if (busy || amount <= 0) return
    if (mode === 'transfer' ? transferIssue : !isAdjust && !cat) return
    setBusy(true)
    const noteValue = note.trim() || undefined
    try {
      if (isEdit && tx) {
        const old = tx
        const patch =
          tx.type === 'adjustment'
            ? { amount: tx.amount < 0 ? -amount : amount, date, note: noteValue }
            : mode === 'transfer'
              ? { type: mode, amount, date, accountId, toAccountId: toAccountId!, categoryId: undefined, note: noteValue }
              : { type: mode, amount, date, accountId, toAccountId: undefined, categoryId: cat!, note: noteValue }
        const updated = await updateTransaction(tx.id, patch)
        appStore.highlight(updated.id)
        close()
        toast.show({
          message: 'Perubahan disimpan',
          action: { label: 'Urungkan', onAction: () => void restoreTransaction(old) },
        })
        return
      }
      if (repeat) {
        const { rule, run } = await createRecurring(
          {
            type: mode,
            amount,
            accountId,
            toAccountId: mode === 'transfer' ? toAccountId! : undefined,
            categoryId: mode === 'transfer' ? undefined : cat!,
            note: noteValue,
            frequency: repeat,
            interval: 1,
            anchorDate: date,
          },
          today,
        )
        const first = run.transactionIds[0]
        if (first) appStore.highlight(first)
        close()
        toast.show({
          message: `Tersimpan · ${describeSchedule(rule)}`,
          action: {
            label: 'Urungkan',
            onAction: () => void deleteRecurring(rule.id).then(() => Promise.all(run.transactionIds.map((id) => deleteTransaction(id)))),
          },
        })
        return
      }
      const saved =
        mode === 'transfer'
          ? await addTransfer({ fromAccountId: accountId, toAccountId: toAccountId!, amount, date, note: noteValue })
          : await addTransaction({ type: mode, amount, date, accountId, categoryId: cat!, note: noteValue })
      if (import.meta.env.DEV) console.info(`[arus] boot→simpan ${Math.round(performance.now())} ms`)
      appStore.highlight(saved.id)
      close()
      toast.show({
        message: `Tersimpan · ${txToastLabel(saved, lookup)}`,
        action: { label: 'Urungkan', onAction: () => void deleteTransaction(saved.id) },
      })
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onCategory = (id: ID) => {
    setCategoryId(id)
    if (!isEdit && amount > 0) void save(id)
  }

  const applyFavorite = async (t: Template) => {
    if (busy) return
    setBusy(true)
    try {
      const saved = await applyTemplate(t.id, today)
      appStore.highlight(saved.id)
      close()
      toast.show({
        message: `Tersimpan · ${t.label} ${formatShort(t.amount)}`,
        action: { label: 'Urungkan', onAction: () => void deleteTransaction(saved.id) },
      })
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const fillTemplate = (t: Template) => {
    setMode(t.type)
    setAmount(t.amount)
    setCategoryId(t.categoryId)
    if (t.accountId && activeAccounts.some((a) => a.id === t.accountId)) setAccountId(t.accountId)
    setNote(t.note ?? '')
  }

  const makeFavorite = async () => {
    if (!tx || !categoryId || mode === 'transfer') return
    const cat = lookup.categories.get(categoryId)
    try {
      await createTemplate({
        label: (note.trim() || cat?.name || 'Favorit').slice(0, TEMPLATE_LABEL_MAX),
        type: mode,
        amount,
        categoryId,
        accountId,
        note: note.trim() || undefined,
      })
      toast.show({ message: 'Ditambahkan ke favorit' })
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' })
    }
  }

  const showFavorites = !isEdit && mode !== 'transfer' && amount === 0 && templates.some((t) => t.type === mode)
  const cells = compact ? 8 : 12
  const overflow = kindCats.length > cells
  const shown = overflow ? kindCats.slice(0, cells - 1) : kindCats
  const selectedHidden = overflow && categoryId && !shown.some((c) => c.id === categoryId)
  const showSubmit = isEdit || mode === 'transfer' || !!categoryId || isAdjust

  return (
    <>
      <BottomSheet
        open={open}
        onClose={requestClose}
        detent="full"
        instant={instant}
        className="tx-sheet"
        ariaLabel={isEdit ? 'Ubah transaksi' : 'Catat transaksi'}
        headerLeft={
          <button type="button" className="s-sheet-btn" onClick={requestClose}>
            Batal
          </button>
        }
        headerCenter={
          isAdjust ? (
            <span className="ui-sheet__title">Penyesuaian saldo</span>
          ) : (
            <SegmentedControl
              ariaLabel="Jenis transaksi"
              className="tx-sheet__seg"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'expense', label: 'Keluar' },
                { value: 'income', label: 'Masuk' },
                { value: 'transfer', label: 'Transfer', disabled: !canTransfer },
              ]}
            />
          )
        }
        headerRight={
          isEdit ? (
            <IconButton
              icon="trash"
              label="Hapus transaksi"
              tone="negative"
              onClick={async () => {
                const old = await deleteTransaction(tx!.id)
                close()
                if (old)
                  toast.show({ message: 'Transaksi dihapus', action: { label: 'Urungkan', onAction: () => void restoreTransaction(old) } })
              }}
            />
          ) : (
            <span className="tx-sheet__spacer" />
          )
        }
        footer={
          <Keypad
            value={amount}
            onChange={setAmount}
            onReject={() => setShake((s) => s + 1)}
            captureKeyboard={open && !sub && !confirmDiscard}
            onEscape={requestClose}
            submit={
              showSubmit
                ? {
                    label: isEdit ? 'Simpan perubahan' : 'Simpan',
                    disabled: !valid || busy,
                    onSubmit: () => void save(),
                    hint: mode === 'transfer' && amount > 0 ? transferIssue ?? undefined : undefined,
                  }
                : undefined
            }
          />
        }
      >
        <div className="tx-sheet__amount">
          <AmountDisplay value={amount} mode={mode} shakeKey={shake} />
          {isAdjust && <p className="tx-sheet__adj">{tx!.amount < 0 ? 'Mengurangi saldo' : 'Menambah saldo'} {account?.name}</p>}
        </div>

        <div className="tx-sheet__ctx">
          {mode !== 'transfer' && !isAdjust && (
            <Chip icon={account?.icon ?? 'wallet'} menu onClick={() => setSub('account')}>
              {account?.name ?? 'Akun'}
            </Chip>
          )}
          <Chip icon="calendar" onClick={() => setSub('date')} active={date !== today}>
            {shortDateLabel(date, today)}
          </Chip>
          <Chip icon={note ? 'note' : 'plus'} onClick={() => setSub('note')} active={!!note} className="tx-sheet__note-chip">
            {note || 'Catatan'}
          </Chip>
          {!isEdit && (
            <Chip
              icon="repeat"
              onClick={() => setSub('repeat')}
              active={!!repeat}
              className={repeat ? undefined : 'is-icon-only'}
              aria-label={repeat ? undefined : 'Ulangi'}
            >
              {repeat ? FREQ_LABEL[repeat] : null}
            </Chip>
          )}
          {isEdit && !isAdjust && mode !== 'transfer' && categoryId && (
            <Chip icon="star" onClick={makeFavorite} className="is-icon-only" aria-label="Jadikan favorit" title="Jadikan favorit">
              {null}
            </Chip>
          )}
        </div>

        {showFavorites && (
          <div className="tx-sheet__favs" aria-label="Favorit">
            {templates
              .filter((t) => t.type === mode)
              .map((t) => (
                <FavoriteChip key={t.id} template={t} onTap={() => void applyFavorite(t)} onHold={() => fillTemplate(t)} />
              ))}
          </div>
        )}

        {mode === 'transfer' ? (
          <div className="tx-sheet__transfer">
            <AccountStrip label="Dari" accounts={activeAccounts} value={accountId} onChange={setAccountId} />
            <AccountStrip label="Ke" accounts={activeAccounts} value={toAccountId} disabledId={accountId} onChange={setToAccountId} />
            <p className="tx-sheet__hint">Ada biaya admin? Catat sebagai pengeluaran terpisah.</p>
          </div>
        ) : isAdjust ? (
          <p className="tx-sheet__hint tx-sheet__hint--center">Penyesuaian tidak dihitung di ringkasan maupun anggaran.</p>
        ) : (
          <div className={cx('ui-cat-grid', 'tx-sheet__grid', compact && 'is-compact')}>
            {shown.map((c) => (
              <CategoryCell
                key={c.id}
                icon={c.icon}
                color={c.color}
                label={c.name}
                selected={c.id === categoryId}
                recent={c.id === lastCategory}
                onClick={() => onCategory(c.id)}
              />
            ))}
            {overflow && (
              <CategoryCell
                icon={selectedHidden ? lookup.categories.get(categoryId!)!.icon : 'dots'}
                color={selectedHidden ? lookup.categories.get(categoryId!)!.color : 'neutral'}
                label={selectedHidden ? lookup.categories.get(categoryId!)!.name : 'Lainnya…'}
                selected={!!selectedHidden}
                onClick={() => setSub('cats')}
              />
            )}
          </div>
        )}
      </BottomSheet>

      <AccountPickerSheet
        open={sub === 'account'}
        onClose={() => setSub(null)}
        value={accountId}
        onSelect={(id) => {
          if (id) setAccountId(id)
          setSub(null)
        }}
      />
      <DatePickerSheet
        open={sub === 'date'}
        onClose={() => setSub(null)}
        value={date}
        today={today}
        onSelect={(d) => {
          setDate(d)
          setSub(null)
        }}
      />
      <NoteSheet open={sub === 'note'} onClose={() => setSub(null)} value={note} onChange={setNote} categoryId={categoryId} />
      <ChoiceSheet<Frequency | 'none'>
        open={sub === 'repeat'}
        onClose={() => setSub(null)}
        title="Ulangi"
        value={repeat ?? 'none'}
        onSelect={(v) => {
          setRepeat(v === 'none' ? null : v)
          setSub(null)
        }}
        options={[
          { value: 'none', label: 'Tidak berulang' },
          ...(['daily', 'weekly', 'monthly', 'yearly'] as Frequency[]).map((f) => ({
            value: f,
            label: FREQ_LABEL[f],
            detail: describeSchedule({ frequency: f, interval: 1, anchorDate: date }),
          })),
        ]}
        footer={<p className="s-footnote">Arus mencatatnya otomatis setiap kali jatuh tempo. Atur di Pengaturan → Transaksi berulang.</p>}
      />
      <CategoryPickerSheet
        open={sub === 'cats'}
        onClose={() => setSub(null)}
        categories={kindCats}
        value={categoryId}
        onSelect={(id) => {
          setSub(null)
          onCategory(id)
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Buang perubahan?"
        confirmLabel="Buang perubahan"
        cancelLabel="Lanjut mengedit"
        onConfirm={() => {
          setConfirmDiscard(false)
          close()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}

function AccountStrip({
  label,
  accounts,
  value,
  disabledId,
  onChange,
}: {
  label: string
  accounts: Account[]
  value: ID | null
  disabledId?: ID
  onChange: (id: ID) => void
}) {
  return (
    <div className="tx-strip">
      <span className="tx-strip__label">{label}</span>
      <div className="tx-strip__list" role="radiogroup" aria-label={`Akun ${label.toLowerCase()}`}>
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={a.id === value}
            disabled={a.id === disabledId}
            className={cx('tx-strip__item', a.id === value && 'is-selected')}
            onClick={() => onChange(a.id)}
          >
            <span className="tx-strip__icon" style={{ ['--cat' as string]: `var(--${a.color})` }}>
              <Icon name={a.icon} size={17} />
            </span>
            {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function FavoriteChip({ template, onTap, onHold }: { template: Template; onTap: () => void; onHold: () => void }) {
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  return (
    <button
      type="button"
      className="ui-chip tx-fav"
      onPointerDown={() => {
        held.current = false
        timer.current = window.setTimeout(() => {
          held.current = true
          onHold()
        }, 500)
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerLeave={() => window.clearTimeout(timer.current)}
      onPointerCancel={() => window.clearTimeout(timer.current)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!held.current) onTap()
      }}
      aria-label={`${template.label} ${formatShort(template.amount)}, tekan lama untuk mengubah`}
    >
      <Icon name="star" size={15} />
      <span className="ui-chip__label">
        {template.label} · <span className="num">{formatShort(template.amount)}</span>
      </span>
    </button>
  )
}

function NoteSheet({
  open,
  onClose,
  value,
  onChange,
  categoryId,
}: {
  open: boolean
  onClose: () => void
  value: string
  onChange: (v: string) => void
  categoryId: ID | null
}) {
  const ref = useRef<HTMLInputElement>(null)
  const recent = useRecentNotes(categoryId ?? undefined) ?? []
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Catatan"
      detent="auto"
      initialFocus={ref}
      headerRight={
        <button type="button" className="s-sheet-btn is-strong" onClick={onClose}>
          Selesai
        </button>
      }
    >
      <div className="s-form">
        <TextField
          ref={ref}
          value={value}
          onChange={(v) => onChange(v.slice(0, 120))}
          placeholder="Mis. kopi dengan klien"
          clearable
          enterKeyHint="done"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        {recent.length > 0 && (
          <div className="s-suggest">
            <p className="s-suggest__label">Terakhir dipakai</p>
            <div className="s-suggest__chips">
              {recent.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="ui-chip"
                  onClick={() => {
                    onChange(n)
                    onClose()
                  }}
                >
                  <span className="ui-chip__label">{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
