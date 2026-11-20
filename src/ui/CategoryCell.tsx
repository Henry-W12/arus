import type { IconName } from './icons'
import { CategoryIcon, type CategoryColor, type CategoryColorToken } from './ListRow'

export interface CategoryCellProps {
  icon: IconName
  color: CategoryColor | CategoryColorToken | 'neutral'
  label: string
  selected?: boolean
  /** Titik accent kecil: kategori terakhir dipakai. */
  recent?: boolean
  onClick?: () => void
  disabled?: boolean
}

/** Sel kategori grid input (DESIGN.md §6.8): squircle 44 + label 2 baris. Pakai di dalam `.ui-cat-grid`. */
export function CategoryCell({ icon, color, label, selected, recent, onClick, disabled }: CategoryCellProps) {
  return (
    <button
      type="button"
      className={['ui-cat-cell', selected && 'is-selected', recent && 'is-recent'].filter(Boolean).join(' ')}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="ui-cat-cell__icon">
        <CategoryIcon icon={icon} color={color} size={44} />
      </span>
      <span className="ui-cat-cell__label">{label}</span>
    </button>
  )
}
