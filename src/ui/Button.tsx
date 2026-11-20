import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = accent penuh; secondary = accent-soft; plain = teks accent; destructive = teks negative; neutral = surface-2 */
  variant?: 'primary' | 'secondary' | 'plain' | 'destructive' | 'neutral'
  /** lg 52 · md 44 · sm 32 */
  size?: 'lg' | 'md' | 'sm'
  block?: boolean
  icon?: IconName
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 17 : 20} />}
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Wajib: label aksesibel bahasa Indonesia. */
  label: string
  size?: number
  tone?: 'accent' | 'ink' | 'ink-2' | 'ink-3' | 'negative'
}

/** Tombol ikon dengan target sentuh 44×44. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 22, tone = 'accent', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx('ui-icon-btn', `tone-${tone}`, className)}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
})

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName | ReactNode
  /** Tampilkan chevron-down (membuka pilihan). */
  menu?: boolean
  /** Terisi/aktif (filter): accent-soft + teks accent. */
  active?: boolean
}

/** Chip 32 px (DESIGN.md §6.7). */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { icon, menu, active, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('ui-chip', active && 'is-active', className)}
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    >
      {typeof icon === 'string' ? <Icon name={icon as IconName} size={17} /> : icon}
      <span className="ui-chip__label">{children}</span>
      {menu && <Icon name="chevron-down" size={14} className="ui-chip__chev" strokeWidth={2} />}
    </button>
  )
})
