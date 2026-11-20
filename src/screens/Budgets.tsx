/* Anggaran (PRD §3.5, §5.5). */
import { useMemo, useState } from 'react'
import { removeBudget, setBudget } from '../db/repo'
import type { ID, PeriodKey } from '../db/schema'
import { diffDays } from '../lib/dates'
import { useAllTransactions, useBudgetOverview, useCategories, useCurrentPeriod, useLookup, useSettings, useToday } from '../lib/hooks'
import { formatIDR } from '../lib/money'
import { formatPeriodLabel, periodLength, periodOf, shiftPeriod } from '../lib/period'
import { earliestDate } from '../lib/summary'
import { AmountText, Button, CategoryIcon, EmptyState, ListGroup, ListRow, ProgressBar, Screen, useRouter, useToast } from '../ui'
import { AmountSheet, GroupLabel, PeriodNav, useErrorToast, useHorizontalSwipe, useSheetState } from './shared'

export function BudgetsScreen() {
  const router = useRouter()
  const toast = useToast()
  const onError = useErrorToast()
  const today = useToday()
  const settings = useSettings()
  const current = useCurrentPeriod()
  const lookup = useLookup()
  const cats = useCategories('expense')
  const all = useAllTransactions()
  const [editing, setEditing] = useState(false)
  const qp = router.query.get('p')
  const key: PeriodKey | undefined = qp && current && qp <= current.key ? qp : current?.key
  const data = useBudgetOverview(key)
  const sheet = useSheetState<{ categoryId: ID; amount: number }>()

  const minKey = useMemo(() => {
    const first = all ? earliestDate(all) : null
    return first && settings ? periodOf(first, settings.periodStartDay).key : null
  }, [all, settings])
  const setKey = (k: PeriodKey) => {
    if (!current || k > current.key || (minKey && k < minKey && k < current.key)) return
    router.setQuery({ p: k === current.key ? null : k }, { replace: true })
  }
  const swipe = useHorizontalSwipe((dir) => key && setKey(shiftPeriod(key, dir)))

  if (!data || !lookup || !current || !settings || !cats || !key) return <Screen title="Anggaran">{null}</Screen>

  const isCurrent = key === current.key
  const todayRatio = isCurrent ? (diffDays(data.period.start, today) + 1) / periodLength(data.period) : undefined
  const budgetOf = new Map(data.lines.map((l) => [l.categoryId, l.budget]))
  const openSheet = (categoryId: ID) => sheet.show({ categoryId, amount: budgetOf.get(categoryId) ?? 0 })
  const cat = sheet.data ? lookup.categories.get(sheet.data.categoryId) : undefined

  const save = async (amount: number) => {
    if (!sheet.data) return
    try {
      await setBudget(sheet.data.categoryId, key, amount)
      sheet.hide()
      toast.show({ message: `Anggaran ${cat?.name ?? ''} disimpan` })
    } catch (e) {
      onError(e)
    }
  }
  const remove = async () => {
    if (!sheet.data) return
    try {
      await removeBudget(sheet.data.categoryId, key)
      sheet.hide()
      toast.show({ message: 'Anggaran dihapus' })
    } catch (e) {
      onError(e)
    }
  }

  const t = data.total
  return (
    <Screen
      title="Anggaran"
      actions={
        <button type="button" className="s-sheet-btn is-strong s-nav-text" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Selesai' : 'Atur'}
        </button>
      }
    >
      <div {...swipe}>
        <PeriodNav period={data.period} onChange={setKey} min={minKey} max={current.key} showRange={settings.periodStartDay !== 1} />

        {editing ? (
          <>
            <GroupLabel>Anggaran per kategori · {formatPeriodLabel(key)}</GroupLabel>
            <ListGroup>
              {cats.map((c) => {
                const b = budgetOf.get(c.id)
                return (
                  <ListRow
                    key={c.id}
                    leading={<CategoryIcon icon={c.icon} color={c.color} />}
                    title={c.name}
                    trailing={b ? <AmountText value={b} /> : <span className="ink-3">Belum diatur</span>}
                    chevron
                    onClick={() => openSheet(c.id)}
                  />
                )
              })}
            </ListGroup>
            <p className="s-footnote">Nominal berlaku mulai {formatPeriodLabel(key)} dan seterusnya sampai diubah.</p>
          </>
        ) : (
          <>
            {t ? (
              <div className="s-card s-budget-total">
                <span className="s-stats__label">{t.remaining >= 0 ? 'Sisa' : 'Lebih'}</span>
                <AmountText value={Math.abs(t.remaining)} size="amount-l" className={t.remaining < 0 ? 'is-negative' : undefined} />
                <span className="s-budget-total__of num">
                  dari {formatIDR(t.budget)} · terpakai {formatIDR(t.spent)}
                </span>
                <ProgressBar value={t.spent} max={t.budget} thickness={6} today={todayRatio} ariaLabel="Total anggaran terpakai" />
                {data.perDay && (
                  <span className="s-budget-total__day num">
                    ≈ <strong>{formatIDR(data.perDay.amount)}/hari</strong> untuk {data.perDay.daysLeft} hari lagi
                  </span>
                )}
              </div>
            ) : (
              <EmptyState
                icon="gauge"
                title="Belum ada anggaran"
                description="Anggaran membantu melihat sisa uang per kategori. Atur sekali, berlaku tiap bulan."
                action={{ label: 'Atur anggaran', onClick: () => setEditing(true) }}
              />
            )}

            {data.lines.length > 0 && (
              <>
                <GroupLabel>Per kategori</GroupLabel>
                <div className="ui-group ui-group--inset">
                  {data.lines.map((l) => {
                    const c = lookup.categories.get(l.categoryId)
                    return (
                      <button key={l.categoryId} type="button" className="s-brow" onClick={() => openSheet(l.categoryId)}>
                        <CategoryIcon icon={c?.icon ?? 'dots'} color={c?.color ?? 'c12'} />
                        <span className="s-brow__main">
                          <span className="s-brow__top">
                            <span className="s-brow__name">{c?.name}</span>
                            <span className={l.remaining < 0 ? 's-brow__left is-over num' : 's-brow__left num'}>
                              {l.remaining < 0 ? `Lebih ${formatIDR(-l.remaining)}` : `Sisa ${formatIDR(l.remaining)}`}
                            </span>
                          </span>
                          <ProgressBar value={l.spent} max={l.budget} today={todayRatio} ariaLabel={`${c?.name} terpakai`} />
                          <span className="s-brow__sub num">
                            {formatIDR(l.spent)} / {formatIDR(l.budget)}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {data.unbudgeted.length > 0 && (
              <>
                <GroupLabel>Tanpa anggaran</GroupLabel>
                <ListGroup>
                  {data.unbudgeted.map((u) => {
                    const c = lookup.categories.get(u.categoryId)
                    return (
                      <ListRow
                        key={u.categoryId}
                        leading={<CategoryIcon icon={c?.icon ?? 'dots'} color={c?.color ?? 'c12'} />}
                        title={c?.name}
                        subtitle={<AmountText value={u.spent} size="inherit" className="ink-2" />}
                        trailing={<span className="ui-btn ui-btn--secondary ui-btn--sm">Atur</span>}
                        onClick={() => openSheet(u.categoryId)}
                      />
                    )
                  })}
                </ListGroup>
              </>
            )}
            {!isCurrent && data.lines.length > 0 && <p className="s-footnote">Menampilkan anggaran yang berlaku pada {formatPeriodLabel(key)}.</p>}
          </>
        )}
      </div>

      <AmountSheet
        open={sheet.open}
        onClose={sheet.hide}
        title={cat ? `Anggaran ${cat.name}` : 'Anggaran'}
        initial={sheet.data?.amount ?? 0}
        info={() =>
          isCurrent
            ? `Berlaku mulai ${formatPeriodLabel(key)} dan seterusnya`
            : `Berlaku mulai ${formatPeriodLabel(key)}. Juga berlaku untuk bulan-bulan sesudahnya sampai ada perubahan berikutnya.`
        }
        onSave={save}
        extra={
          <div className="s-sheet-actions">
            <Button
              variant="plain"
              onClick={() => {
                sheet.hide()
                router.navigate(`/cari?cat=${sheet.data?.categoryId}&from=${data.period.start}&to=${data.period.end}`)
              }}
            >
              Lihat transaksi
            </Button>
            {sheet.data && budgetOf.has(sheet.data.categoryId) && (
              <Button variant="plain" className="is-negative" onClick={remove}>
                Hapus anggaran
              </Button>
            )}
          </div>
        }
      />
    </Screen>
  )
}
