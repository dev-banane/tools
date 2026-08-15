import { error, json } from '../lib/http'
import { clientKey, rateLimit } from '../lib/rate-limit'

const DEFAULT_TLDS = [
  'com',
  'net',
  'org',
  'io',
  'dev',
  'app',
  'ai',
  'co',
  'xyz',
  'info',
  'biz',
  'me',
  'tv',
  'cc',
  'so',
  'sh',
  'live',
  'tech',
  'online',
  'store',
  'site',
  'cloud',
  'email',
  'pro',
  'top',
  'name',
  'wtf',
  'gg',
  'to',
  'de',
]

const MAX_TLDS = 40
const CONCURRENCY = 2
const RETRY_DELAYS_MS = [500, 1200, 2500, 4000, 6000]
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const TLD_RE = /^[a-z]{2,24}$/

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type DomainStatus = 'available' | 'taken' | 'unknown'

export type DomainResult = {
  tld: string
  domain: string
  status: DomainStatus
  registrar: string | null
  createdAt: string | null
  expiresAt: string | null
}

type RdapEvent = { eventAction: string; eventDate: string }
type RdapEntity = { roles?: string[]; vcardArray?: unknown }
type RdapResponse = { entities?: RdapEntity[]; events?: RdapEvent[] }

function extractName(entity: RdapEntity): string | null {
  const vcard = entity.vcardArray
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return null
  const fields = vcard[1] as unknown[][]
  const fn = fields.find((field) => field[0] === 'fn')
  const value = fn?.[3]
  return typeof value === 'string' ? value : null
}

async function checkTld(label: string, tld: string): Promise<DomainResult> {
  const domain = `${label}.${tld}`
  const unknown: DomainResult = { tld, domain, status: 'unknown', registrar: null, createdAt: null, expiresAt: null }

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: {
          accept: 'application/rdap+json',
          'user-agent': 'devjakob-tools/1.0 (+https://tools.devjakob.com)',
        },
        signal: AbortSignal.timeout(7000),
      })

      if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
        await res.arrayBuffer().catch(() => undefined)
        await sleep(RETRY_DELAYS_MS[attempt]!)
        continue
      }

      if (res.status === 404) {
        await res.arrayBuffer().catch(() => undefined)
        return { ...unknown, status: 'available' }
      }

      if (!res.ok) {
        await res.arrayBuffer().catch(() => undefined)
        return unknown
      }

      const data = (await res.json()) as RdapResponse
      const registrarEntity = data.entities?.find((entity) => entity.roles?.includes('registrar'))

      return {
        tld,
        domain,
        status: 'taken',
        registrar: registrarEntity ? extractName(registrarEntity) : null,
        createdAt: data.events?.find((e) => e.eventAction === 'registration')?.eventDate ?? null,
        expiresAt: data.events?.find((e) => e.eventAction === 'expiration')?.eventDate ?? null,
      }
    } catch {
      return unknown
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index]!)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export async function handleDomain(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'domain'), { limit: 15, windowMs: 60_000 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const raw = (url.searchParams.get('name') ?? '').trim().toLowerCase()
  if (!raw) return error('Enter a domain name')

  const label = raw.split('.')[0] ?? ''
  if (!LABEL_RE.test(label)) return error('Enter a valid name (letters, numbers, hyphens)')

  const tldsParam = url.searchParams.get('tlds')
  let tlds = tldsParam
    ? tldsParam
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/^\./, ''))
        .filter((t) => TLD_RE.test(t))
    : DEFAULT_TLDS

  tlds = [...new Set(tlds)].slice(0, MAX_TLDS)
  if (!tlds.length) return error('Provide at least one valid TLD')

  const results = await mapWithConcurrency(tlds, CONCURRENCY, (tld) => checkTld(label, tld))

  return json({
    ok: true,
    data: {
      name: label,
      results,
      checkedAt: new Date().toISOString(),
    },
  })
}
