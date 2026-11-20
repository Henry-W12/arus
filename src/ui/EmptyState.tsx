import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export interface EmptyStateProps {
  icon: IconName
  title: ReactNode
  description?: ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}

/** State kosong (DESIGN.md §6.12): ikon garis 40, judul, deskripsi, tombol sekunder. Tanpa ilustrasi. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={['ui-empty', className].filter(Boolean).join(' ')}>
      <Icon name={icon} size={40} strokeWidth={1.25} className="ui-empty__icon" />
      <p className="ui-empty__title">{title}</p>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && (
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--pill" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
