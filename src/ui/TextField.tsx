import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string
  onChange: (value: string) => void
  label?: ReactNode
  /** Ikon di kiri (mis. 'search'). */
  icon?: IconName
  /** Tampilkan tombol hapus isi saat ada teks. */
  clearable?: boolean
  /** Teks bantuan / error di bawah field. */
  hint?: ReactNode
  error?: ReactNode
}

/** Field teks 48 px, latar surface-2, font ≥16 px (anti-zoom iOS). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { value, onChange, label, icon, clearable, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId()
  const fid = id ?? autoId
  const hintId = `${fid}-hint`
  return (
    <div className={['ui-field', error && 'is-error', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="ui-field__label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="ui-field__box">
        {icon && <Icon name={icon} size={18} className="ui-field__icon" />}
        <input
          ref={ref}
          id={fid}
          className="ui-field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? hintId : undefined}
          {...rest}
        />
        {clearable && value && (
          <button
            type="button"
            className="ui-field__clear"
            aria-label="Hapus isian"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onChange('')}
          >
            <Icon name="x" size={14} strokeWidth={2.25} />
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={hintId} className="ui-field__hint">
          {error || hint}
        </p>
      )}
    </div>
  )
})
