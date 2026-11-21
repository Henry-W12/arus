/* Ringkasan (PRD §3.4): periode, tiga angka + delta, donat kategori, tren 6 periode. */
import { useMemo, useState, type CSSProperties } from 'react'
import type { CategoryKind, PeriodKey } from '../db/schema'
import { MONTHS_SHORT } from '../lib/dates'
import { useCurrentPeriod, useLookup, usePeriodSummary, useSettings } from '../lib/hooks'
import { formatIDR, formatIDRShort, formatPercent } from '../lib/money'
import { formatPeriodLabel, shiftPeriod } from '../lib/period'
import type { TrendPoint } from '../lib/summary'
import { AmountText, CategoryIcon, DonutChart, EmptyState, Icon, Screen, SegmentedControl, useRouter, useSheet } from '../ui'
import { PeriodNav, cx, useHorizontalSwipe } from './shared'

export function SummaryScreen() {
  const router = useRouter()
  const sheet = useSheet()
  const current = useCurrentPeriod()
  const settings = useSettings()
  const lookup = useLookup()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [selected, setSelected] = useState<string | null>(null)
  const qp = router.query.get('p')
  const key: PeriodKey | undefined = qp && current && qp <= current.key ? qp : current?.key
  const data = usePeriodSummary(key, kind)

  const setKey = (k: PeriodKey) => {
    if (!current || k > current.key || (data?.firstKey && k < data.firstKey)) return
    setSelected(null)
    router.setQuery({ p: k === current.key ? null : k }, { replace: true })
  }
  const swipe = useHorizontalSwipe((dir) => key && setKey(shiftPeriod(key, dir)))

  const segments = useMemo(
    () =>
      (data?.segments ?? []).map((s) => {
        const c = s.categoryId ? lookup?.categories.get(s.categoryId) : undefined
        return { id: s.categoryId ?? 'other', value: s.amount, color: c ? `var(--${c.color})` : 'var(--ink-3)', label: c?.name ?? 'Lainnya', share: s.share }
      }),
    [data, lookup],
  )

  if (!data || !lookup || !current || !settings || !key) return <Screen title="Ringkasan">{null}</Screen>

  const kindLabel = kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'
  const total = kind === 'expense' ? data.totals.expense : data.totals.income
  const sel = segments.find((s) => s.id === selected)
  const isEmptyDb = data.firstKey === null

  return (
    <Screen title="Ringkasan">
      <div {...swipe}>
        {!isEmptyDb && <PeriodNav period={data.period} onChange={setKey} min={data.firstKey} max={current.key} showRange={settings.periodStartDay !== 1} />}

        {isEmptyDb ? (
          <EmptyState
            icon="chart-donut"
            title="Belum ada data"
            description="Ringkasan muncul setelah ada pemasukan atau pengeluaran tercatat."
            action={{ label: 'Catat transaksi', onClick: () => sheet.open('add') }}
          />
        ) : (
          <>
            <div className="s-stats">
              <Stat label="Pemasukan" value={data.totals.income} delta={data.delta.income} good="up" kind="income" />
              <Stat label="Pengeluaran" value={data.totals.expense} delta={data.delta.expense} good="down" kind="expense" />
              <div className="s-stats__net">
                <span className="s-stats__label">Selisih</span>
                <span className="s-stats__netval">
                  <AmountText value={Math.abs(data.totals.net)} kind={data.totals.net >= 0 ? 'income' : 'expense'} size="inherit" />
                  <Delta value={data.delta.net} good="up" />
                </span>
              </div>
            </div>

            <div className="s-kind">
              <SegmentedControl
                ariaLabel="Jenis donat"
                value={kind}
                onChange={(k) => {
                  setKind(k)
                  setSelected(null)
                }}
                options={[
                  { value: 'expense', label: 'Pengeluaran' },
                  { value: 'income', label: 'Pemasukan' },
                ]}
              />
            </div>

            <div className="s-donut-wrap">
              <DonutChart
                segments={segments}
                selectedId={selected}
                onSelect={setSelected}
                ariaLabel={`${kindLabel} ${formatPeriodLabel(key)}: ${segments.map((s) => `${s.label} ${formatPercent(s.share)}`).join(', ') || 'kosong'}`}
                centerValue={total > 0 ? <AmountText value={sel ? sel.value : total} size="inherit" /> : undefined}
                centerLabel={total > 0 ? (sel ? `${sel.label} · ${formatPercent(sel.share)}` : kindLabel) : undefined}
              />
              {total === 0 && <p className="s-donut-empty">Belum ada {kindLabel.toLowerCase()} di periode ini</p>}
            </div>

            {data.breakdown.length > 0 && (
              <div className="ui-group ui-group--inset s-catlist">
                {data.breakdown.map((row) => {
                  const c = lookup.categories.get(row.categoryId)
                  const segId = segments.some((s) => s.id === row.categoryId) ? row.categoryId : 'other'
                  return (
                    <button
                      key={row.categoryId}
                      type="button"
                      className={cx('s-catrow', selected && selected === segId && 'is-selected')}
                      onClick={() => router.navigate(`/cari?cat=${row.categoryId}&from=${data.period.start}&to=${data.period.end}`)}
                    >
                      <CategoryIcon icon={c?.icon ?? 'dots'} color={c?.color ?? 'c12'} />
                      <span className="s-catrow__main">
                        <span className="s-catrow__top">
                          <span className="s-catrow__name">{c?.name ?? 'Kategori'}</span>
                          <AmountText value={row.amount} className="s-catrow__amt" />
                        </span>
                        <span className="s-catrow__bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(2, row.share * 100)}%`, background: `var(--${c?.color ?? 'c12'})` }} />
                        </span>
                        <span className="s-catrow__meta num">
                          <span>{row.count} transaksi</span>
                          <span>{formatPercent(row.share)}</span>
                        </span>
                      </span>
                      <Icon name="chevron-right" size={17} strokeWidth={2} className="s-catrow__chev" />
                    </button>
                  )
                })}
              </div>
            )}

            <div className="s-trend-head">
              <span>Tren 6 bulan</span>
              <span className="s-legend">
                <i className="is-exp" /> Keluar <i className="is-inc" /> Masuk
              </span>
            </div>
            <div className="s-card s-trend-card">
              <TrendChart points={data.trend} selected={key} onSelect={setKey} min={data.firstKey} />
            </div>
            <p className="s-footnote">Transfer dan penyesuaian saldo tidak dihitung.</p>
          </>
        )}
      </div>
    </Screen>
  )
}

function Delta({ value, good }: { value: number | null; good: 'up' | 'down' }) {
  if (value === null || !Number.isFinite(value)) return <span className="s-delta is-none">—</span>
  const up = value > 0
  const flat = Math.round(value * 100) === 0
  const tone = flat ? 'is-none' : (up ? good === 'up' : good === 'down') ? 'is-good' : 'is-bad'
  return (
    <span className={cx('s-delta num', tone)}>
      {flat ? '' : up ? '▲ ' : '▼ '}
      {formatPercent(Math.abs(value))}
    </span>
  )
}

function Stat({ label, value, delta, good, kind }: { label: string; value: number; delta: number | null; good: 'up' | 'down'; kind: 'income' | 'expense' }) {
  return (
    <div className="s-stats__cell">
      <span className="s-stats__label">{label}</span>
      {/* --len: jumlah karakter "Rp 1.234.567" → ukuran huruf menyusut agar nominal 12 digit tetap utuh (BUG-07) */}
      <AmountText
        value={value}
        size="title"
        className={cx('s-stats__value', kind === 'income' && 'is-positive')}
        style={{ '--len': formatIDR(value).length } as CSSProperties}
      />
      <span className="s-stats__delta">
        <Delta value={delta} good={good} /> <span className="ink-2">vs bln lalu</span>
      </span>
    </div>
  )
}

/** Bar chart tren 6 periode: pasangan bar keluar/masuk (DESIGN.md §7). */
function TrendChart({ points, selected, onSelect, min }: { points: TrendPoint[]; selected: PeriodKey; onSelect: (k: PeriodKey) => void; min: PeriodKey | null }) {
  const W = 330
  const H = 140
  const top = 18
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expense)))
  const col = W / points.length
  const h = (v: number) => (v <= 0 ? 0 : Math.max(2, ((H - top) * v) / max))
  const bar = (x: number, v: number) => {
    const hh = h(v)
    if (hh === 0) return ''
    const y = H - hh
    const r = Math.min(3, hh)
    return `M${x} ${H}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + 8 - r}Q${x + 8} ${y} ${x + 8} ${y + r}V${H}Z`
  }
  return (
    <svg className="s-trend" viewBox={`0 0 ${W} ${H + 22}`} role="img" aria-label={`Tren: ${points.map((p) => `${MONTHS_SHORT[Number(p.key.slice(5)) - 1]} keluar ${formatIDRShort(p.expense)}, masuk ${formatIDRShort(p.income)}`).join('; ')}`}>
      <text x={0} y={10} className="s-trend__max">
        {formatIDRShort(max)}
      </text>
      <line x1={0} x2={W} y1={H + 0.25} y2={H + 0.25} className="s-trend__base" />
      {points.map((p, i) => {
        const cx0 = col * i + col / 2
        const on = p.key === selected
        const disabled = !!min && p.key < min
        return (
          <g key={p.key} className={cx('s-trend__col', on && 'is-on', disabled && 'is-disabled')} onClick={() => !disabled && onSelect(p.key)}>
            <rect x={col * i} y={0} width={col} height={H + 22} fill="transparent" />
            <path d={bar(cx0 - 9.5, p.expense)} className="s-trend__exp" />
            <path d={bar(cx0 + 1.5, p.income)} className="s-trend__inc" />
            <text x={cx0} y={H + 16} textAnchor="middle" className="s-trend__label">
              {MONTHS_SHORT[Number(p.key.slice(5)) - 1]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
