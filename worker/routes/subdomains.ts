import { error, json } from '../lib/http'
import { parseHostname } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'

type SourceResult = {
  id: string
  name: string
  count: number
  error?: string
}

type Source = {
  id: string
  name: string
  fetch: (host: string) => Promise<string[]>
}

function normalize(names: Iterable<string>, host: string): string[] {
  const suffix = `.${host}`
  const out = new Set<string>()

  for (const raw of names) {
    for (const part of String(raw).split(/[\s,]+/)) {
      const name = part.trim().toLowerCase().replace(/\.$/, '').replace(/^\*\./, '')
      if (!name || name === host) continue
      if (!name.endsWith(suffix)) continue
      if (!/^[a-z0-9._-]+$/.test(name)) continue
      out.add(name)
    }
  }

  return [...out]
}

const SOURCES: Source[] = [
  {
    id: 'crtsh',
    name: 'crt.sh',
    async fetch(host) {
      const url = `https://crt.sh/?q=${encodeURIComponent(`%.${host}`)}&output=json`
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(20_000), // crt.sh is slow on large zones
      })
      if (!res.ok) throw new Error(`crt.sh returned ${res.status}`)

      const text = await res.text()
      if (!text.trim()) return []

      let rows: Array<{ name_value?: string; common_name?: string }>
      try {
        rows = JSON.parse(text)
      } catch {
        throw new Error('crt.sh returned invalid JSON')
      }

      return normalize(
        rows.flatMap((row) => [row.name_value ?? '', row.common_name ?? '']),
        host,
      )
    },
  },
  {
    id: 'certspotter',
    name: 'Cert Spotter',
    async fetch(host) {
      const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(host)}&include_subdomains=true&expand=dns_names`
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      })
      if (res.status === 429) throw new Error('Rate limited')
      if (!res.ok) throw new Error(`Cert Spotter returned ${res.status}`)

      const rows = (await res.json()) as Array<{ dns_names?: string[] }>
      return normalize(
        rows.flatMap((row) => row.dns_names ?? []),
        host,
      )
    },
  },
  {
    id: 'urlscan',
    name: 'urlscan.io',
    async fetch(host) {
      const url = `https://urlscan.io/api/v1/search/?q=domain%3A${encodeURIComponent(host)}&size=100`
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      })
      if (res.status === 429) throw new Error('Rate limited')
      if (!res.ok) throw new Error(`urlscan returned ${res.status}`)

      const data = (await res.json()) as {
        results?: Array<{ page?: { domain?: string }; task?: { domain?: string } }>
      }
      return normalize(
        (data.results ?? []).flatMap((row) => [row.page?.domain ?? '', row.task?.domain ?? '']),
        host,
      )
    },
  },
  {
    id: 'otx',
    name: 'AlienVault OTX',
    async fetch(host) {
      const url = `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(host)}/passive_dns`
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) throw new Error(`OTX returned ${res.status}`)

      const data = (await res.json()) as { passive_dns?: Array<{ hostname?: string }> }
      return normalize(
        (data.passive_dns ?? []).map((row) => row.hostname ?? ''),
        host,
      )
    },
  },
  {
    id: 'hackertarget',
    name: 'HackerTarget',
    async fetch(host) {
      const url = `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(host)}`
      const res = await fetch(url, {
        headers: { accept: 'text/plain', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) throw new Error(`HackerTarget returned ${res.status}`)

      const text = await res.text()
      if (/API count exceeded|error/i.test(text)) throw new Error('Daily quota reached')

      return normalize(
        text.split('\n').map((line) => line.split(',')[0] ?? ''),
        host,
      )
    },
  },
]

const USER_AGENT = 'devjakob-tools/1.0 (+https://tools.devjakob.com)'

export async function handleSubdomains(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'subdomains'), { limit: 8, windowMs: 60_000 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const host = parseHostname(url.searchParams.get('host') ?? '')
  if (!host) return error('Enter a valid hostname')

  const settled = await Promise.allSettled(SOURCES.map((source) => source.fetch(host)))

  const found = new Set<string>()
  const sources: SourceResult[] = settled.map((result, index) => {
    const source = SOURCES[index]!
    if (result.status === 'rejected') {
      const reason = result.reason
      return {
        id: source.id,
        name: source.name,
        count: 0,
        error:
          reason instanceof Error
            ? reason.name === 'TimeoutError'
              ? 'Timed out'
              : reason.message
            : 'Lookup failed',
      }
    }
    for (const name of result.value) found.add(name)
    return { id: source.id, name: source.name, count: result.value.length }
  })

  if (found.size === 0 && sources.every((s) => s.error)) {
    return error('Every enumeration source failed. Try again in a moment.', 502)
  }

  const subdomains = [...found].sort((a, b) => {
    const depth = a.split('.').length - b.split('.').length
    return depth !== 0 ? depth : a.localeCompare(b)
  })

  return json({
    ok: true,
    data: {
      host,
      count: subdomains.length,
      subdomains,
      sources,
      checkedAt: new Date().toISOString(),
    },
  })
}
