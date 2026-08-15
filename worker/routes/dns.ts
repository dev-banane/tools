import { error, json } from '../lib/http'
import { parseHostname } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'
import {
  RCODE_TEXT,
  RECORD_TYPES,
  decodeResponse,
  encodeQuery,
  type RecordType,
} from '../lib/dns-wire'

type Resolver = {
  id: string
  name: string
  location: string
  country: string
  countryCode: string | null
  endpoint: string
  filtering?: boolean
}

const RESOLVERS: Resolver[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    location: 'Anycast',
    country: 'Global',
    countryCode: null,
    endpoint: 'https://cloudflare-dns.com/dns-query',
  },
  {
    id: 'google',
    name: 'Google',
    location: 'Anycast',
    country: 'Global',
    countryCode: null,
    endpoint: 'https://dns.google/dns-query',
  },
  {
    id: 'opendns',
    name: 'OpenDNS',
    location: 'San Francisco',
    country: 'United States',
    countryCode: 'US',
    endpoint: 'https://doh.opendns.com/dns-query',
  },
  {
    id: 'adguard',
    name: 'AdGuard',
    location: 'Limassol',
    country: 'Cyprus',
    countryCode: 'CY',
    endpoint: 'https://unfiltered.adguard-dns.com/dns-query',
  },
  {
    id: 'controld',
    name: 'Control D',
    location: 'Toronto',
    country: 'Canada',
    countryCode: 'CA',
    endpoint: 'https://freedns.controld.com/p0',
  },
  {
    id: 'dnssb',
    name: 'DNS.SB',
    location: 'Frankfurt',
    country: 'Germany',
    countryCode: 'DE',
    endpoint: 'https://doh.dns.sb/dns-query',
  },
  {
    id: 'ffmuc',
    name: 'FFMUC',
    location: 'Munich',
    country: 'Germany',
    countryCode: 'DE',
    endpoint: 'https://doh.ffmuc.net/dns-query',
  },
  {
    id: 'libredns',
    name: 'LibreDNS',
    location: 'Athens',
    country: 'Greece',
    countryCode: 'GR',
    endpoint: 'https://doh.libredns.gr/dns-query',
  },
  {
    id: 'brahma',
    name: 'Brahma World',
    location: 'São Paulo',
    country: 'Brazil',
    countryCode: 'BR',
    endpoint: 'https://dns.brahma.world/dns-query',
  },
  {
    id: 'iij',
    name: 'IIJ Public',
    location: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    endpoint: 'https://public.dns.iij.jp/dns-query',
  },
  {
    id: 'tiar',
    name: 'Tiarap',
    location: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    endpoint: 'https://doh.tiar.app/dns-query',
  },
  {
    id: 'alidns',
    name: 'AliDNS',
    location: 'Hangzhou',
    country: 'China',
    countryCode: 'CN',
    endpoint: 'https://dns.alidns.com/dns-query',
  },
  {
    id: 'dnspod',
    name: 'DNSPod',
    location: 'Shenzhen',
    country: 'China',
    countryCode: 'CN',
    endpoint: 'https://doh.pub/dns-query',
  },
]

type ResolverResult = {
  id: string
  name: string
  location: string
  country: string
  countryCode: string | null
  filtering: boolean
  records: string[]
  ttl: number | null
  rcode: string
  ms: number
  error?: string
  match: boolean
}

async function queryResolver(
  resolver: Resolver,
  query: Uint8Array,
): Promise<Omit<ResolverResult, 'match'>> {
  const base = {
    id: resolver.id,
    name: resolver.name,
    location: resolver.location,
    country: resolver.country,
    countryCode: resolver.countryCode,
    filtering: resolver.filtering ?? false,
  }
  const started = Date.now()

  try {
    // POST avoids intermediate cache (RFC 8484).
    const res = await fetch(resolver.endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/dns-message',
        'content-type': 'application/dns-message',
      },
      body: query,
      signal: AbortSignal.timeout(6000),
    })

    const ms = Date.now() - started

    if (!res.ok) {
      return { ...base, records: [], ttl: null, rcode: '-', ms, error: `HTTP ${res.status}` }
    }

    const body = new Uint8Array(await res.arrayBuffer())
    const { rcode, answers } = decodeResponse(body)

    return {
      ...base,
      records: answers.map((a) => a.data),
      ttl: answers[0]?.ttl ?? null,
      rcode: RCODE_TEXT[rcode] ?? `RCODE ${rcode}`,
      ms,
    }
  } catch (err) {
    return {
      ...base,
      records: [],
      ttl: null,
      rcode: '-',
      ms: Date.now() - started,
      error:
        err instanceof Error
          ? err.name === 'TimeoutError'
            ? 'Timed out'
            : err.message
          : 'Query failed',
    }
  }
}

function signatureOf(records: string[]): string {
  return [...records].sort().join('|')
}

export async function handleDns(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'dns'), { limit: 25 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const host = parseHostname(url.searchParams.get('host') ?? '')
  if (!host) return error('Enter a valid hostname')

  const typeParam = (url.searchParams.get('type') ?? 'A').toUpperCase()
  if (!(typeParam in RECORD_TYPES)) return error('Unsupported record type')
  const type = typeParam as RecordType

  let query: Uint8Array
  try {
    query = encodeQuery(host, type)
  } catch {
    return error('Enter a valid hostname')
  }

  const raw = await Promise.all(RESOLVERS.map((resolver) => queryResolver(resolver, query)))

  // Empty answers don't vote
  const tally = new Map<string, number>()
  for (const result of raw) {
    if (!result.records.length) continue
    const signature = signatureOf(result.records)
    tally.set(signature, (tally.get(signature) ?? 0) + 1)
  }

  let consensus = ''
  let best = 0
  for (const [signature, count] of tally) {
    if (count > best) {
      best = count
      consensus = signature
    }
  }

  const results: ResolverResult[] = raw.map((result) => ({
    ...result,
    match: result.records.length > 0 && signatureOf(result.records) === consensus,
  }))

  const answered = results.filter((r) => r.records.length > 0).length
  const consensusRecords = consensus ? consensus.split('|') : []

  return json({
    ok: true,
    data: {
      host,
      type,
      consensus: consensusRecords,
      agreeing: best,
      answered,
      total: results.length,
      results,
      checkedAt: new Date().toISOString(),
    },
  })
}
