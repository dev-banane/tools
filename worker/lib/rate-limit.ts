const buckets = new Map<string, { count: number; resetAt: number }>()

let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

function sweepExpired(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function rateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now()
  sweepExpired(now)
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { ok: true }
}

export function clientKey(request: Request, route: string) {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  return `${route}:${ip}`
}
