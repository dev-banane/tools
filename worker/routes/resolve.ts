import { error, json } from '../lib/http'
import { parseHostname } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'
import { isCloudflareIp, providerFromCname } from '../lib/net'

const MAX_HOSTS = 25

export type ResolvedHost = {
  host: string
  ips: string[]
  cname: string | null
  provider: string | null
  cloudflare: boolean
  status: 'ok' | 'nxdomain' | 'empty' | 'error'
}

type DohAnswer = { name: string; type: number; TTL?: number; data: string }

async function resolveHost(host: string): Promise<ResolvedHost> {
  const base: ResolvedHost = {
    host,
    ips: [],
    cname: null,
    provider: null,
    cloudflare: false,
    status: 'error',
  }

  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return base

    const data = (await res.json()) as { Status?: number; Answer?: DohAnswer[] }
    if (data.Status === 3) return { ...base, status: 'nxdomain' }

    const answers = data.Answer ?? []
    const ips = answers.filter((a) => a.type === 1).map((a) => a.data)
    const cname = answers.filter((a) => a.type === 5).at(-1)?.data.replace(/\.$/, '') ?? null

    return {
      host,
      ips,
      cname,
      provider: providerFromCname(cname) ?? (ips.some(isCloudflareIp) ? 'Cloudflare' : null),
      cloudflare: ips.some(isCloudflareIp) || /cloudflare/i.test(cname ?? ''),
      status: ips.length ? 'ok' : 'empty',
    }
  } catch {
    return base
  }
}

export async function handleResolve(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'resolve'), { limit: 120, windowMs: 60_000 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const raw = (url.searchParams.get('hosts') ?? '').split(',')

  const hosts: string[] = []
  for (const entry of raw) {
    const host = parseHostname(entry)
    if (host && !hosts.includes(host)) hosts.push(host)
    if (hosts.length >= MAX_HOSTS) break
  }

  if (!hosts.length) return error('Provide at least one hostname')

  const results = await Promise.all(hosts.map(resolveHost))
  return json({ ok: true, data: { results } })
}
