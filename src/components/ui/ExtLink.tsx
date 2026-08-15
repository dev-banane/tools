import type { ReactNode } from 'react'

function childText(children: ReactNode): string | undefined {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children) && children.length === 1) return childText(children[0])
  return undefined
}

function isIpv4(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
}

function isIpv6(value: string): boolean {
  return value.includes(':') && /^[0-9a-f:.]+$/i.test(value)
}

export function toExternalHref(value: string): string | null {
  let raw = value.trim()
  if (!raw) return null

  if (/^https?:\/\//i.test(raw)) return raw

  // MX / SRV style: "10 mail.example.com."
  const prefixed = raw.match(/^\d+\s+(\S+)$/)
  if (prefixed) raw = prefixed[1]

  // DNS answers often include a trailing root dot.
  raw = raw.replace(/\.$/, '')
  if (!raw) return null

  // IPs are addresses, not destinations - don't wrap them in links.
  if (isIpv4(raw) || isIpv6(raw)) return null

  if (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(raw)) {
    return `https://${raw}`
  }

  return null
}

type ExtLinkProps = {
  href?: string
  value?: string
  children: ReactNode
  className?: string
  title?: string
}

export function ExtLink({ href, value, children, className, title }: ExtLinkProps) {
  const text = value ?? childText(children)
  const resolved = href ?? (text ? toExternalHref(text) : null)
  const classes = ['ext-link', className].filter(Boolean).join(' ')

  if (!resolved) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    )
  }

  return (
    <a
      href={resolved}
      className={classes}
      title={title ?? resolved}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}
