import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from './overlay'

export interface ActionSheetOption {
  label: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

export interface ActionSheetProps {
  open: boolean
  title?: ReactNode
  message?: ReactNode
  options: ActionSheetOption[]
  cancelLabel?: string
  onCancel: () => void
}

/** Action sheet iOS dengan beberapa pilihan (generalisasi ConfirmDialog). */
export function ActionSheet({ open, title, message, options, cancelLabel = 'Batal', onCancel }: ActionSheetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const phase = useOverlay({ open, onClose: onCancel, ref: rootRef, exitMs: 260 })
  if (phase === 'closed') return null
  return createPortal(
    <div ref={rootRef} className={['ui-action', phase === 'open' && 'is-open'].filter(Boolean).join(' ')} tabIndex={-1}>
      <div className="ui-sheet__scrim" onClick={onCancel} aria-hidden="true" />
      <div
        className="ui-action__panel"
        role="alertdialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Pilihan'}
      >
        <div className="ui-action__group">
          {(title || message) && (
            <div className="ui-action__head">
              {title && (
                <p id={titleId} className="ui-action__title">
                  {title}
                </p>
              )}
              {message && <p className="ui-action__msg">{message}</p>}
            </div>
          )}
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={o.disabled}
              className={['ui-action__btn', 'ui-action__btn--sep', o.destructive && 'is-destructive'].filter(Boolean).join(' ')}
              onClick={o.onSelect}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button type="button" className="ui-action__btn ui-action__cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
