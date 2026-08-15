import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Icon } from '../Icon'
import { copyText } from '../../lib/toast'
import { Button } from './Button'
import { ExtLink, toExternalHref } from './ExtLink'

function useCopied(timeout = 1400) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const mark = useCallback(() => {
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), timeout)
  }, [timeout])

  return [copied, mark] as const
}

type CopyButtonProps = {
  value: string
  label?: string
  toastLabel?: string
  size?: 'md' | 'sm'
  variant?: 'primary' | 'social' | 'quiet' | 'bare'
}

export function CopyButton({
  value,
  label,
  toastLabel = 'Copied to clipboard',
  size = 'sm',
  variant = 'quiet',
}: CopyButtonProps) {
  const [copied, mark] = useCopied()

  async function onCopy() {
    if (await copyText(value, toastLabel)) mark()
  }

  return (
    <Button
      variant={variant}
      size={size}
      iconOnly={!label}
      onClick={onCopy}
      aria-label={label ? undefined : 'Copy'}
      title={label ? undefined : 'Copy'}
    >
      <Icon name={copied ? 'tick-02' : 'copy-01'} size={size === 'sm' ? 13 : 15} />
      {label ? (copied ? 'Copied' : label) : null}
    </Button>
  )
}

type KeyRowProps = {
  value: string
  toastLabel?: string
}

export function KeyRow({ value, toastLabel = 'Copied to clipboard' }: KeyRowProps) {
  const [copied, mark] = useCopied()
  const href = toExternalHref(value)

  async function onCopy() {
    if (await copyText(value, toastLabel)) mark()
  }

  function onRowClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a')) return
    void onCopy()
  }

  return (
    <div
      className="keyrow"
      role="button"
      tabIndex={0}
      data-copied={copied ? 'true' : undefined}
      onClick={onRowClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void onCopy()
        }
      }}
    >
      {href ? (
        <ExtLink className="keyrow__value" href={href} title={value}>
          {value}
        </ExtLink>
      ) : (
        <span className="keyrow__value" title={value}>
          {value}
        </span>
      )}
      <span className="keyrow__hint">
        <Icon name={copied ? 'tick-02' : 'copy-01'} size={12} />
        {copied ? 'Copied' : 'Copy'}
      </span>
    </div>
  )
}
