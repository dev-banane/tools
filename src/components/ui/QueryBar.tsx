import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../../lib/hugeicons'
import { Button } from './Button'

type QueryBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  icon?: IconName
  submitLabel: string
  loading?: boolean
  disabled?: boolean
  children?: ReactNode
  inputMode?: 'text' | 'url' | 'numeric'
  'aria-label'?: string
}

export function QueryBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  icon = 'search-01',
  submitLabel,
  loading = false,
  disabled = false,
  children,
  inputMode = 'text',
  'aria-label': ariaLabel = 'Query',
}: QueryBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading || disabled) return
    onSubmit()
  }

  return (
    <form className="query" onSubmit={handleSubmit}>
      <div className="query__bar">
        <span className="query__icon" aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
        <input
          className="query__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode={inputMode}
        />
        {children ? (
          <>
            <span className="query__divider" aria-hidden="true" />
            {children}
          </>
        ) : null}
        <Button type="submit" variant="primary" loading={loading} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
