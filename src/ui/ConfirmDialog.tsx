import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from './overlay'

export interface ConfirmDialogProps {
  open: boolean
  /** Judul kecil di atas pilihan (mis. "Buang perubahan?"). */
  title?: ReactNode
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Pilihan konfirmasi berwarna negative (hapus/buang). Default true. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Action sheet gaya iOS (DESIGN.md §6.4): grup pilihan + tombol Batal terpisah. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const msgId = useId()
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
        aria-describedby={message ? msgId : undefined}
        aria-label={title ? undefined : confirmLabel}
      >
        <div className="ui-action__group">
          {(title || message) && (
            <div className="ui-action__head">
              {title && (
                <p id={titleId} className="ui-action__title">
                  {title}
                </p>
              )}
              {message && (
                <p id={msgId} className="ui-action__msg">
                  {message}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            className={['ui-action__btn', destructive && 'is-destructive'].filter(Boolean).join(' ')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
        <button type="button" className="ui-action__btn ui-action__cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
