import { error, json } from '../lib/http'
import { parseHttpUrl } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'

export async function handleTtfb(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'ttfb'), { limit: 20 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const target = parseHttpUrl(url.searchParams.get('url') ?? '')
  if (!target) return error('Enter a valid http(s) URL')

  const samples = Math.min(5, Math.max(1, Number(url.searchParams.get('samples') ?? 3) || 3))
  const timings: number[] = []
  let status = 0
  let statusText = ''
  let finalUrl = target.toString()
  let errorMessage: string | undefined

  for (let i = 0; i < samples; i++) {
    const started = performance.now()
    try {
      const res = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'devjakob-tools/1.0 (+https://tools.devjakob.com)',
          accept: '*/*',
        },
      })
      const ms = Math.round(performance.now() - started)
      timings.push(ms)
      status = res.status
      statusText = res.statusText
      finalUrl = res.url
      await res.arrayBuffer().catch(() => undefined)
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Request failed'
      break
    }
  }

  if (!timings.length) {
    return error(errorMessage ?? 'Request failed', 502)
  }

  const sorted = [...timings].sort((a, b) => a - b)
  const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)

  return json({
    ok: true,
    data: {
      url: target.toString(),
      finalUrl,
      status,
      statusText,
      samples: timings,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      colo: (request as Request & { cf?: IncomingRequestCfProperties }).cf?.colo ?? null,
    },
  })
}
