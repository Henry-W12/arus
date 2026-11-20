import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

export interface DonutSegment {
  id: string
  value: number
  /** Warna CSS, mis. 'var(--c1)'. "Lainnya" → 'var(--ink-3)'. */
  color: string
  label?: string
}

export interface DonutChartProps {
  /** Urut terbesar dulu (maks 6 + "Lainnya"); nilai ≤ 0 diabaikan. */
  segments: DonutSegment[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** Isi tengah — biasanya <AmountText size="inherit"/> */
  centerValue?: ReactNode
  centerLabel?: ReactNode
  /** Ringkasan untuk pembaca layar, mis. "Pengeluaran November: Makan 42%, …" */
  ariaLabel: string
  /** Diameter px (default 184, ketebalan 16 berskala). */
  size?: number
  className?: string
}

const MIN_ANGLE = (2 * Math.PI) / 180 // 2°

function layout(values: number[], gap: number): [number, number][] {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  const n = values.length
  const avail = 2 * Math.PI - (n > 1 ? gap * n : 0)
  let ang = values.map((v) => (v / total) * avail)
  // Sudut minimum 2° agar segmen kecil tetap terlihat.
  const small = ang.map((a) => a < MIN_ANGLE)
  const smallSum = small.filter(Boolean).length * MIN_ANGLE
  const bigSum = ang.reduce((s, a, i) => (small[i] ? s : s + a), 0)
  if (smallSum > 0 && bigSum > 0) {
    const k = (avail - smallSum) / bigSum
    ang = ang.map((a, i) => (small[i] ? MIN_ANGLE : a * k))
  }
  const out: [number, number][] = []
  let t = n > 1 ? gap / 2 : 0
  for (const a of ang) {
    out.push([t, t + a])
    t += a + (n > 1 ? gap : 0)
  }
  return out
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${(cx + r * Math.sin(a)).toFixed(3)} ${(cy - r * Math.cos(a)).toFixed(3)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(a0)}A${r} ${r} 0 ${large} 1 ${p(a1)}`
}

/** Donat SVG buatan sendiri (DESIGN.md §7). */
export function DonutChart({
  segments,
  selectedId,
  onSelect,
  centerValue,
  centerLabel,
  ariaLabel,
  size = 184,
  className,
}: DonutChartProps) {
  const maskId = useId()
  const valueRef = useRef<HTMLDivElement>(null)
  // Nominal tengah mengecil otomatis agar muat di lubang donat.
  useLayoutEffect(() => {
    const el = valueRef.current
    if (!el) return
    el.style.transform = ''
    const avail = size - 2 * 20 * (size / 184) - 24
    const w = el.scrollWidth
    if (w > avail) el.style.transform = `scale(${(avail / w).toFixed(3)})`
  })
  const segs = segments.filter((s) => s.value > 0)
  const k = size / 184
  const thick = 16 * k
  const thickSel = 20 * k
  const r = (size - thickSel) / 2
  const c = size / 2
  const gap = (2 * k) / r
  const angles = layout(
    segs.map((s) => s.value),
    gap,
  )
  const hasSel = selectedId != null && segs.some((s) => s.id === selectedId)

  return (
    <div className={['ui-donut', className].filter(Boolean).join(' ')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={size} height={size}>
            <circle
              className="ui-donut__sweep"
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="white"
              strokeWidth={thickSel + 4}
              pathLength={1}
              transform={`rotate(-90 ${c} ${c})`}
            />
          </mask>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={thick} opacity={segs.length ? 0 : 1} />
        <g mask={`url(#${maskId})`}>
          {segs.length === 1 ? (
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={segs[0].color}
              strokeWidth={selectedId === segs[0].id ? thickSel : thick}
              className="ui-donut__seg"
              onClick={onSelect ? () => onSelect(selectedId === segs[0].id ? null : segs[0].id) : undefined}
            />
          ) : (
            segs.map((s, i) => {
              const [a0, a1] = angles[i]
              const sel = s.id === selectedId
              return (
                <path
                  key={s.id}
                  d={arc(c, c, r, a0, a1)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={sel ? thickSel : thick}
                  strokeLinecap="butt"
                  opacity={hasSel && !sel ? 0.35 : 1}
                  className="ui-donut__seg"
                  onClick={onSelect ? () => onSelect(sel ? null : s.id) : undefined}
                />
              )
            })
          )}
        </g>
      </svg>
      {(centerValue || centerLabel) && (
        <div className="ui-donut__center" aria-hidden="true">
          {centerValue && (
            <div ref={valueRef} className="ui-donut__value num">
              {centerValue}
            </div>
          )}
          {centerLabel && <div className="ui-donut__label">{centerLabel}</div>}
        </div>
      )}
    </div>
  )
}
