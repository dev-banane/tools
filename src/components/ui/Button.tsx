import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from '../Icon'

type Variant = 'primary' | 'social' | 'quiet' | 'bare'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'md' | 'sm'
  loading?: boolean
  iconOnly?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'social',
  size = 'md',
  loading = false,
  iconOnly = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    iconOnly ? 'btn--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <Icon name="loading-03" size={size === 'sm' ? 13 : 15} className="btn__spinner" />
      ) : null}
      {children}
    </button>
  )
}
