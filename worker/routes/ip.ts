import { error, json } from '../lib/http'
import { isIp, parseHostname } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'

export type GeoPayload = {
  ip: string
  version: 'IPv4' | 'IPv6'
  hostname: string | null
  city: string | null
  region: string | null
  postal: string | null
  country: string | null
  countryCode: string | null
  continent: string | null
  isEu: boolean | null
  capital: string | null
  callingCode: string | null
  lat: number | null
  lon: number | null
  timezone: string | null
  utcOffset: number | null
  isp: string | null
  org: string | null
  asn: string | null
  asnName: string | null
  domain: string | null
  isVisitor: boolean
  colo: string | null
  sources: string[]
}

function emptyPayload(ip: string): GeoPayload {
  return {
    ip,
    version: ip.includes(':') ? 'IPv6' : 'IPv4',
    hostname: null,
    city: null,
    region: null,
    postal: null,
    country: null,
    countryCode: null,
    continent: null,
    isEu: null,
    capital: null,
    callingCode: null,
    lat: null,
    lon: null,
    timezone: null,
    utcOffset: null,
    isp: null,
    org: null,
    asn: null,
    asnName: null,
    domain: null,
    isVisitor: false,
    colo: null,
    sources: [],
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function lookupIpwho(ip: string): Promise<Partial<GeoPayload>> {
  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`Geolocation lookup failed (${res.status})`)

  const data = (await res.json()) as Record<string, unknown>
  if (data.success === false) {
    throw new Error(str(data.message) ?? 'That address could not be located')
  }

  const connection = (data.connection ?? {}) as Record<string, unknown>
  const timezone = (data.timezone ?? {}) as Record<string, unknown>

  return {
    ip: str(data.ip) ?? ip,
    version: str(data.type) === 'IPv6' ? 'IPv6' : 'IPv4',
    city: str(data.city),
    region: str(data.region),
    postal: str(data.postal),
    country: str(data.country),
    countryCode: str(data.country_code),
    continent: str(data.continent),
    isEu: typeof data.is_eu === 'boolean' ? data.is_eu : null,
    capital: str(data.capital),
    callingCode: str(data.calling_code),
    lat: num(data.latitude),
    lon: num(data.longitude),
    timezone: str(timezone.id),
    utcOffset: num(timezone.offset),
    isp: str(connection.isp),
    org: str(connection.org),
    asn: connection.asn != null ? `AS${connection.asn}` : null,
    asnName: str(connection.org) ?? str(connection.isp),
    domain: str(connection.domain),
  }
}

async function resolveToIp(host: string): Promise<string | null> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
    { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) },
  )
  if (!res.ok) return null

  const data = (await res.json()) as { Answer?: Array<{ type: number; data: string }> }
  return data.Answer?.find((answer) => answer.type === 1)?.data ?? null
}

async function ownPublicIp(): Promise<string> {
  const res = await fetch('https://ipwho.is/', {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return ''
  const data = (await res.json()) as { ip?: string }
  return data.ip ?? ''
}

function visitorIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    ''
  )
}

export async function handleIp(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'ip'), { limit: 40 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') ?? url.searchParams.get('ip') ?? '').trim()
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf

  let ip = query
  let hostname: string | null = null
  const isVisitor = !query

  if (isVisitor) {
    ip = visitorIp(request)
    if (!ip) {
      // Local dev: no cf-connecting-ip, use egress IP.
      ip = await ownPublicIp().catch(() => '')
      if (!ip) return error('Could not determine your IP address', 502)
    }
  } else if (!isIp(query)) {
    const host = parseHostname(query)
    if (!host) return error('Enter an IP address or hostname')

    const resolvedIp = await resolveToIp(host).catch(() => null)
    if (!resolvedIp) return error(`No A record found for ${host}`, 404)

    ip = resolvedIp
    hostname = host
  }

  const payload = emptyPayload(ip)
  payload.hostname = hostname
  payload.isVisitor = isVisitor

  if (isVisitor && cf) {
    payload.city = cf.city ?? null
    payload.region = cf.region ?? null
    payload.postal = cf.postalCode ?? null
    payload.countryCode = cf.country ?? null
    payload.continent = cf.continent ?? null
    payload.lat = cf.latitude ? Number(cf.latitude) : null
    payload.lon = cf.longitude ? Number(cf.longitude) : null
    payload.timezone = cf.timezone ?? null
    payload.org = cf.asOrganization ?? null
    payload.asnName = cf.asOrganization ?? null
    payload.asn = cf.asn ? `AS${cf.asn}` : null
    payload.colo = cf.colo ?? null
    payload.sources.push('Cloudflare edge')
  }

  try {
    const geo = await lookupIpwho(ip)
    for (const [key, value] of Object.entries(geo)) {
      if (value != null) (payload as Record<string, unknown>)[key] = value
    }
    payload.sources.push('ipwho.is')
  } catch (err) {
    if (!payload.sources.length) {
      return error(err instanceof Error ? err.message : 'Lookup failed', 502)
    }
  }

  payload.isVisitor = isVisitor
  payload.hostname = hostname

  return json({ ok: true, data: payload })
}

const TILE_MAX_ZOOM = 18

export async function handleTile(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'tile'), { limit: 200, windowMs: 60_000 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const z = Number(url.searchParams.get('z'))
  const x = Number(url.searchParams.get('x'))
  const y = Number(url.searchParams.get('y'))

  const max = 2 ** z
  if (
    !Number.isInteger(z) ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    z < 0 ||
    z > TILE_MAX_ZOOM ||
    x < 0 ||
    x >= max ||
    y < 0 ||
    y >= max
  ) {
    return error('Invalid tile coordinates')
  }

  const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
    headers: { 'user-agent': 'devjakob-tools/1.0 (+https://tools.devjakob.com)' },
    cf: { cacheEverything: true, cacheTtl: 86_400 },
    signal: AbortSignal.timeout(6000),
  })

  if (!upstream.ok) return new Response(null, { status: 502 })

  return new Response(upstream.body, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400, immutable',
    },
  })
}
