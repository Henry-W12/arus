import { useRef, type KeyboardEvent } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  /** Lebar penuh (default) atau mengikuti konten. */
  block?: boolean
  className?: string
}

/** Segmented control (DESIGN.md §6.5): track surface-2, thumb bergeser 220 ms. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  block = true,
  className,
}: SegmentedControlProps<T>) {
  const ref = useRef<HTMLDivElement>(null)
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const n = options.length

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    for (let step = 1; step <= n; step++) {
      const o = options[(index + dir * step + n) % n]
      if (!o.disabled) {
        onChange(o.value)
        const btn = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[options.indexOf(o)]
        btn?.focus()
        return
      }
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      className={['ui-seg', block && 'ui-seg--block', className].filter(Boolean).join(' ')}
      style={{ ['--seg-n' as string]: n, ['--seg-i' as string]: index }}
      onKeyDown={onKeyDown}
    >
      <span className="ui-seg__thumb" aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === index ? 0 : -1}
          disabled={o.disabled}
          className={['ui-seg__item', i === index && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
