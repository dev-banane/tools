import { error, json } from '../lib/http'
import { parseHttpUrl } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'

export type Hop = {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  setCookies: string[]
  redirectedTo?: string
  timingMs: number
}

const MAX_HOPS = 10

export async function followRedirects(start: URL): Promise<Hop[]> {
  const hops: Hop[] = []
  let current = start.toString()

  for (let i = 0; i < MAX_HOPS; i++) {
    const started = performance.now()
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'user-agent': 'devjakob-tools/1.0 (+https://tools.devjakob.com)',
        accept: '*/*',
      },
    })
    const timingMs = Math.round(performance.now() - started)
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })

    const location = res.headers.get('location')
    const hop: Hop = {
      url: current,
      status: res.status,
      statusText: res.statusText,
      headers,
      setCookies: res.headers.getSetCookie?.() ?? [],
      timingMs,
    }

    await res.arrayBuffer().catch(() => undefined)

    if (location && res.status >= 300 && res.status < 400) {
      const next = new URL(location, current).toString()
      hop.redirectedTo = next
      hops.push(hop)
      current = next
      continue
    }

    hops.push(hop)
    break
  }

  return hops
}

export async function handleHeaders(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'headers'), { limit: 20 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const target = parseHttpUrl(url.searchParams.get('url') ?? '')
  if (!target) return error('Enter a valid http(s) URL')

  try {
    const hops = await followRedirects(target)
    return json({ ok: true, data: { url: target.toString(), hops } })
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Fetch failed', 502)
  }
}
