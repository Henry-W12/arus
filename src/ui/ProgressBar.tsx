export type ProgressStatus = 'ok' | 'warning' | 'over'

/** Status warna anggaran: < 80% ok, 80–100% warning, > 100% over (PRD §3.5). */
export function budgetStatus(spent: number, limit: number): ProgressStatus {
  if (limit <= 0) return spent > 0 ? 'over' : 'ok'
  const r = spent / limit
  return r > 1 ? 'over' : r >= 0.8 ? 'warning' : 'ok'
}

export interface ProgressBarProps {
  /** Terpakai (integer) */
  value: number
  /** Batas anggaran */
  max: number
  /** Posisi penanda "hari ini" 0–1 (porsi periode berjalan). Kosongkan untuk periode lampau. */
  today?: number
  /** 4 (default, baris) atau 6 (kartu total). */
  thickness?: 4 | 6
  /** Override status otomatis. */
  status?: ProgressStatus
  ariaLabel?: string
  className?: string
}

/** Bar progres anggaran dengan penanda "hari ini" (DESIGN.md §6.10). */
export function ProgressBar({ value, max, today, thickness = 4, status, ariaLabel, className }: ProgressBarProps) {
  const st = status ?? budgetStatus(value, max)
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : value > 0 ? 1 : 0
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      className={['ui-progress', `ui-progress--${thickness}`, `is-${st}`, className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(pct, 100)}
      aria-valuetext={`${pct}%`}
      aria-label={ariaLabel}
    >
      <div className="ui-progress__track">
        <div className="ui-progress__fill" style={{ transform: `scaleX(${st === 'over' ? 1 : ratio})` }} />
      </div>
      {today !== undefined && (
        <span className="ui-progress__today" style={{ left: `${Math.min(1, Math.max(0, today)) * 100}%` }} aria-hidden="true" />
      )}
    </div>
  )
}
