/* Cari & filter (PRD §3.3). */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ID, LocalDate, TransactionType } from '../db/schema'
import { formatDateMedium, isValidLocalDate } from '../lib/dates'
import { useAccounts, useAllTransactions, useCategories, useLookup, useSearch, useSettings, useToday } from '../lib/hooks'
import { formatIDR, parseAmountText } from '../lib/money'
import { datePresetRange, searchSuggestions, type DatePreset, type SearchFilter } from '../lib/search'
import { groupByDay } from '../lib/summary'
import { AmountText, BottomSheet, Button, Chip, EmptyState, Screen, TextField, useRouter, useSheet } from '../ui'
import { ChoiceSheet, DatePickerSheet, DayList, MultiChoiceSheet, cx, useDeleteTx, useHighlightReset } from './shared'

type TypeFilter = 'all' | 'expense' | 'income' | 'transfer'
type DateFilter = { preset: DatePreset | 'custom'; from: LocalDate; to: LocalDate } | null

interface FilterState {
  query: string
  type: TypeFilter
  categoryIds: ID[]
  accountIds: ID[]
  date: DateFilter
  min: number | null
  max: number | null
  recurringOnly: boolean
  createdSince: number | null
}

const EMPTY: FilterState = { query: '', type: 'all', categoryIds: [], accountIds: [], date: null, min: null, max: null, recurringOnly: false, createdSince: null }
// Filter terakhir diingat selama sesi (bukan persisten).
let sessionFilter: FilterState = EMPTY

const TYPE_LABEL: Record<TypeFilter, string> = { all: 'Jenis', expense: 'Keluar', income: 'Masuk', transfer: 'Transfer' }
const PRESET_LABEL: Record<DatePreset, string> = { thisPeriod: 'Bulan ini', lastPeriod: 'Bulan lalu', last3Periods: '3 bulan', thisYear: 'Tahun ini' }

function fromQuery(q: URLSearchParams): FilterState | null {
  const cat = q.get('cat')
  const from = q.get('from')
  const to = q.get('to')
  const recurring = q.get('recurring') === '1'
  if (!cat && !from && !recurring) return null
  return {
    ...EMPTY,
    categoryIds: cat ? cat.split(',') : [],
    date: from && to && isValidLocalDate(from) && isValidLocalDate(to) ? { preset: 'custom', from, to } : null,
    recurringOnly: recurring,
    createdSince: q.get('since') ? Number(q.get('since')) : null,
  }
}

export function SearchScreen() {
  const router = useRouter()
  const sheet = useSheet()
  const today = useToday()
  const settings = useSettings()
  const lookup = useLookup()
  const accounts = useAccounts({ includeArchived: true })
  const categories = useCategories(undefined, { includeArchived: true })
  const all = useAllTransactions()
  const onDelete = useDeleteTx()
  useHighlightReset()

  const [f, setF] = useState<FilterState>(() => fromQuery(router.query) ?? sessionFilter)
  const [debounced, setDebounced] = useState(f.query)
  const [open, setOpen] = useState<'type' | 'cat' | 'acc' | 'date' | 'from' | 'to' | 'amount' | null>(null)
  const [custom, setCustom] = useState<{ from: LocalDate; to: LocalDate } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    sessionFilter = f
  }, [f])
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(f.query), 150)
    return () => window.clearTimeout(t)
  }, [f.query])
  useEffect(() => {
    if (!fromQuery(router.query)) inputRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filter = useMemo<SearchFilter>(
    () => ({
      query: debounced,
      types: f.type === 'all' ? undefined : ([f.type] as TransactionType[]),
      categoryIds: f.categoryIds,
      accountIds: f.accountIds,
      dateFrom: f.date?.from,
      dateTo: f.date?.to,
      minAmount: f.min ?? undefined,
      maxAmount: f.max ?? undefined,
      recurringOnly: f.recurringOnly || undefined,
      createdSince: f.createdSince ?? undefined,
    }),
    [debounced, f],
  )
  const hasFilter =
    f.type !== 'all' || f.categoryIds.length > 0 || f.accountIds.length > 0 || !!f.date || f.min !== null || f.max !== null || f.recurringOnly
  const active = hasFilter || debounced.trim() !== ''
  const result = useSearch(filter)
  const groups = useMemo(() => (result && active ? groupByDay(result.items) : []), [result, active])
  const suggestions = useMemo(() => (all ? searchSuggestions(all) : null), [all])
  const set = (patch: Partial<FilterState>) => setF((p) => ({ ...p, ...patch }))
  const reset = () => setF(EMPTY)

  const catLabel =
    f.categoryIds.length === 0
      ? 'Kategori'
      : f.categoryIds.length === 1
        ? (lookup?.categories.get(f.categoryIds[0])?.name ?? 'Kategori')
        : `${f.categoryIds.length} kategori`
  const accLabel =
    f.accountIds.length === 0
      ? 'Akun'
      : f.accountIds.length === 1
        ? (lookup?.accounts.get(f.accountIds[0])?.name ?? 'Akun')
        : `${f.accountIds.length} akun`
  const dateLabel = !f.date
    ? 'Tanggal'
    : f.date.preset === 'custom'
      ? f.date.from === f.date.to
        ? formatDateMedium(f.date.from)
        : `${formatDateMedium(f.date.from).replace(/ \d{4}$/, '')} – ${formatDateMedium(f.date.to)}`
      : PRESET_LABEL[f.date.preset]
  const amountLabel =
    f.min === null && f.max === null
      ? 'Nominal'
      : f.min !== null && f.max !== null
        ? `${formatShortRp(f.min)}–${formatShortRp(f.max)}`
        : f.min !== null
          ? `≥ ${formatShortRp(f.min)}`
          : `≤ ${formatShortRp(f.max!)}`

  const startDay = settings?.periodStartDay ?? 1
  const catOptions = (categories ?? [])
    .slice()
    .sort((a, b) => (a.kind === b.kind ? a.sortOrder - b.sortOrder : a.kind === 'expense' ? -1 : 1))
    .map((c) => ({ value: c.id, label: c.kind === 'income' ? `${c.name} · masuk` : c.name, icon: { name: c.icon, color: c.color } }))

  return (
    <Screen title="Cari" large={false} back={{ label: 'Transaksi', onBack: () => router.back('/') }} withTabBar>
      <div className="s-search">
        <TextField
          ref={inputRef}
          type="search"
          icon="search"
          value={f.query}
          onChange={(query) => set({ query })}
          placeholder="Cari catatan, kategori, akun, nominal"
          clearable
          enterKeyHint="search"
          autoComplete="off"
          aria-label="Cari transaksi"
        />
      </div>
      <div className="s-filters" role="toolbar" aria-label="Filter">
        {f.recurringOnly && (
          <Chip icon="repeat" active onClick={() => set({ recurringOnly: false, createdSince: null })}>
            Berulang ×
          </Chip>
        )}
        <Chip menu active={f.type !== 'all'} onClick={() => setOpen('type')}>
          {TYPE_LABEL[f.type]}
        </Chip>
        <Chip menu active={f.categoryIds.length > 0} onClick={() => setOpen('cat')}>
          {catLabel}
        </Chip>
        <Chip menu active={f.accountIds.length > 0} onClick={() => setOpen('acc')}>
          {accLabel}
        </Chip>
        <Chip menu active={!!f.date} onClick={() => setOpen('date')}>
          {dateLabel}
        </Chip>
        <Chip menu active={f.min !== null || f.max !== null} onClick={() => setOpen('amount')}>
          {amountLabel}
        </Chip>
      </div>

      {active && result && lookup ? (
        result.count === 0 ? (
          <EmptyState icon="search" title="Tidak ada yang cocok" description="Coba kata lain atau longgarkan filter." action={{ label: 'Reset filter', onClick: reset }} />
        ) : (
          <>
            <div className="s-result-sum">
              <span className="num">
                {result.count} transaksi
                {(result.totals.income > 0 || result.totals.expense > 0) && (
                  <>
                    {' · '}
                    <AmountText value={Math.abs(result.totals.net)} kind={result.totals.net >= 0 ? 'income' : 'expense'} size="inherit" />
                  </>
                )}
                {result.scheduledCount > 0 && <span className="s-result-sum__note"> · {result.scheduledCount} terjadwal belum dihitung</span>}
              </span>
              {(hasFilter || f.query) && (
                <button type="button" className="s-result-sum__reset" onClick={reset}>
                  Reset
                </button>
              )}
            </div>
            <DayList groups={groups} today={today} lookup={lookup} onOpen={(tx) => sheet.open('tx', { id: tx.id })} onDelete={onDelete} />
          </>
        )
      ) : (
        suggestions &&
        lookup &&
        (suggestions.categoryIds.length > 0 || suggestions.notes.length > 0 ? (
          <div className="s-suggest-block">
            {suggestions.categoryIds.length > 0 && (
              <>
                <p className="s-suggest__label">Kategori yang sering dipakai</p>
                <div className="s-suggest__chips">
                  {suggestions.categoryIds.map((id) => {
                    const c = lookup.categories.get(id)
                    if (!c) return null
                    return (
                      <Chip key={id} icon={c.icon} onClick={() => set({ categoryIds: [id] })}>
                        {c.name}
                      </Chip>
                    )
                  })}
                </div>
              </>
            )}
            {suggestions.notes.length > 0 && (
              <>
                <p className="s-suggest__label">Catatan yang sering muncul</p>
                <div className="s-suggest__chips">
                  {suggestions.notes.map((n) => (
                    <Chip key={n} icon="note" onClick={() => set({ query: n })}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <EmptyState icon="search" title="Cari transaksi" description="Ketik catatan, nama kategori, akun, atau nominal seperti 25rb." />
        ))
      )}

      <ChoiceSheet<TypeFilter>
        open={open === 'type'}
        onClose={() => setOpen(null)}
        title="Jenis"
        value={f.type}
        options={[
          { value: 'all', label: 'Semua' },
          { value: 'expense', label: 'Keluar' },
          { value: 'income', label: 'Masuk' },
          { value: 'transfer', label: 'Transfer' },
        ]}
        onSelect={(type) => {
          set({ type })
          setOpen(null)
        }}
      />
      <MultiChoiceSheet open={open === 'cat'} onClose={() => setOpen(null)} title="Kategori" options={catOptions} value={f.categoryIds} onChange={(categoryIds) => set({ categoryIds })} />
      <MultiChoiceSheet
        open={open === 'acc'}
        onClose={() => setOpen(null)}
        title="Akun"
        options={(accounts ?? []).map((a) => ({ value: a.id, label: a.archived ? `${a.name} (arsip)` : a.name, icon: { name: a.icon, color: a.color } }))}
        value={f.accountIds}
        onChange={(accountIds) => set({ accountIds })}
      />
      <ChoiceSheet<DatePreset | 'custom' | 'none'>
        open={open === 'date'}
        onClose={() => setOpen(null)}
        title="Tanggal"
        value={f.date?.preset ?? 'none'}
        options={[
          { value: 'none', label: 'Semua tanggal' },
          ...(Object.keys(PRESET_LABEL) as DatePreset[]).map((p) => {
            const r = datePresetRange(p, today, startDay)
            return { value: p, label: PRESET_LABEL[p], detail: `${formatDateMedium(r.from)} – ${formatDateMedium(r.to)}` }
          }),
          { value: 'custom', label: 'Kustom…' },
        ]}
        onSelect={(p) => {
          if (p === 'none') set({ date: null })
          else if (p === 'custom') {
            setCustom({ from: f.date?.from ?? today, to: f.date?.to ?? today })
            setOpen('from')
            return
          } else set({ date: { preset: p, ...rangeOf(p, today, startDay) } })
          setOpen(null)
        }}
      />
      <DatePickerSheet
        open={open === 'from'}
        onClose={() => setOpen(null)}
        title="Dari tanggal"
        quick={false}
        value={custom?.from ?? today}
        today={today}
        onSelect={(d) => {
          setCustom((c) => ({ from: d, to: c && c.to >= d ? c.to : d }))
          setOpen('to')
        }}
      />
      <DatePickerSheet
        open={open === 'to'}
        onClose={() => setOpen(null)}
        title="Sampai tanggal"
        quick={false}
        value={custom?.to ?? today}
        today={today}
        onSelect={(d) => {
          const from = custom?.from ?? d
          set({ date: { preset: 'custom', from: d < from ? d : from, to: d < from ? from : d } })
          setOpen(null)
        }}
      />
      <AmountRangeSheet open={open === 'amount'} onClose={() => setOpen(null)} min={f.min} max={f.max} onApply={(min, max) => set({ min, max })} />
    </Screen>
  )
}

function rangeOf(p: DatePreset, today: LocalDate, s: number) {
  return datePresetRange(p, today, s)
}

function formatShortRp(n: number) {
  return formatIDR(n).replace(/\.000\.000$/, 'jt').replace(/\.000$/, 'rb')
}

function AmountRangeSheet({
  open,
  onClose,
  min,
  max,
  onApply,
}: {
  open: boolean
  onClose: () => void
  min: number | null
  max: number | null
  onApply: (min: number | null, max: number | null) => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Nominal" detent="auto">
      <AmountRangeBody min={min} max={max} onApply={(a, b) => {
          onApply(a, b)
          onClose()
        }} />
    </BottomSheet>
  )
}

function AmountRangeBody({ min, max, onApply }: { min: number | null; max: number | null; onApply: (min: number | null, max: number | null) => void }) {
  const [a, setA] = useState(min !== null ? String(min) : '')
  const [b, setB] = useState(max !== null ? String(max) : '')
  const pa = a.trim() ? parseAmountText(a) : null
  const pb = b.trim() ? parseAmountText(b) : null
  const bad = (a.trim() && pa === null) || (b.trim() && pb === null) || (pa !== null && pb !== null && pa > pb)
  return (
    <div className="s-form">
      <div className="s-form__row">
        <TextField label="Minimal" value={a} onChange={setA} inputMode="decimal" placeholder="mis. 100rb" />
        <TextField label="Maksimal" value={b} onChange={setB} inputMode="decimal" placeholder="mis. 500rb" />
      </div>
      <p className={cx('s-form__lead', bad && 'is-error')}>{bad ? 'Periksa lagi rentangnya.' : 'Boleh ditulis 25rb, 1,2jt, atau 25.000. Batas ikut terhitung.'}</p>
      <div className="s-form__row">
        <Button variant="neutral" size="lg" onClick={() => onApply(null, null)}>
          Hapus
        </Button>
        <Button size="lg" disabled={!!bad} onClick={() => onApply(pa, pb)}>
          Terapkan
        </Button>
      </div>
    </div>
  )
}
