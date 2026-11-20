import { useId, type ReactNode } from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Label terlihat (opsional — bila kosong wajib `ariaLabel`). */
  label?: ReactNode
  ariaLabel?: string
  disabled?: boolean
  className?: string
}

/** Toggle gaya iOS 51×31; aktif = accent. */
export function Switch({ checked, onChange, label, ariaLabel, disabled, className }: SwitchProps) {
  const id = useId()
  const input = (
    <span className="ui-switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="ui-switch__input"
        checked={checked}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__thumb" />
      </span>
    </span>
  )
  if (!label) return <span className={className}>{input}</span>
  return (
    <label htmlFor={id} className={['ui-switch-row', className].filter(Boolean).join(' ')}>
      <span className="ui-switch-row__label">{label}</span>
      {input}
    </label>
  )
}
