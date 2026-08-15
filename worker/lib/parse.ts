export function parseHttpUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url
  } catch {
    return null
  }
}

export function parseHostname(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/\.$/, '')
  if (!trimmed) return null

  try {
    if (trimmed.includes('://')) {
      const url = new URL(trimmed)
      return url.hostname || null
    }
  } catch {
    return null
  }

  if (!/^[a-z0-9._-]+$/i.test(trimmed)) return null
  if (!trimmed.includes('.')) return null
  return trimmed
}

export function isIp(value: string) {
  const v4 = /^(?:\d{1,3}\.){3}\d{1,3}$/
  const v6 = /^[0-9a-f:]+$/i
  return v4.test(value) || (value.includes(':') && v6.test(value))
}
