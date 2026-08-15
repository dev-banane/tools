import { followRedirects, type Hop } from './headers'
import { error, json } from '../lib/http'
import { parseHttpUrl } from '../lib/parse'
import { clientKey, rateLimit } from '../lib/rate-limit'

export type Finding = {
  id: string
  header: string
  label: string
  status: 'pass' | 'warn' | 'fail' | 'info'
  value?: string
  detail: string
  advice?: string
  docs?: string
}

export type MissingHeader = {
  header: string
  label: string
  detail: string
  example: string
  docs: string
  penalty: number
}

type Definition = {
  id: string
  header: string
  label: string
  penalty: number
  detail: string
  example: string
  docs: string
  evaluate?: (value: string, ctx: Context) => { status: Finding['status']; detail: string; advice?: string }
  satisfiedBy?: (ctx: Context) => string | null
}

type Context = {
  headers: Record<string, string>
  https: boolean
}

const MDN = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers'

const DEFINITIONS: Definition[] = [
  {
    id: 'csp',
    header: 'Content-Security-Policy',
    label: 'Content Security Policy',
    penalty: 25,
    detail:
      'Declares which sources the browser may load scripts, styles and frames from. The single most effective defence against cross-site scripting.',
    example: "Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'none'",
    docs: `${MDN}/Content-Security-Policy`,
    evaluate(value) {
      const issues: string[] = []
      if (/'unsafe-inline'/i.test(value)) issues.push("'unsafe-inline' lets injected inline scripts run")
      if (/'unsafe-eval'/i.test(value)) issues.push("'unsafe-eval' keeps eval() available to attackers")
      if (/(^|;)\s*default-src[^;]*\*/i.test(value)) issues.push('a wildcard source defeats most of the policy')
      if (!/object-src/i.test(value) && !/default-src/i.test(value))
        issues.push('no default-src or object-src fallback')

      if (issues.length) {
        return {
          status: 'warn',
          detail: `Present, but ${issues.join('; ')}.`,
          advice: 'Move to a nonce- or hash-based policy and drop the unsafe directives.',
        }
      }
      return { status: 'pass', detail: 'Present with no unsafe directives.' }
    },
  },
  {
    id: 'hsts',
    header: 'Strict-Transport-Security',
    label: 'HTTP Strict Transport Security',
    penalty: 25,
    detail:
      'Tells browsers to reach this host over HTTPS only, which shuts down protocol-downgrade attacks after the first visit.',
    example: 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    docs: `${MDN}/Strict-Transport-Security`,
    evaluate(value) {
      const maxAge = Number(/max-age=(\d+)/i.exec(value)?.[1] ?? 0)
      const subdomains = /includeSubDomains/i.test(value)
      const issues: string[] = []

      if (maxAge < 15_552_000) issues.push(`max-age is ${maxAge}s, below the recommended 15552000s`)
      if (!subdomains) issues.push('includeSubDomains is not set')

      if (issues.length) {
        return {
          status: 'warn',
          detail: `Present, but ${issues.join(' and ')}.`,
          advice: 'Raise max-age to two years and add includeSubDomains once subdomains are HTTPS-ready.',
        }
      }
      return { status: 'pass', detail: `Enforced for ${Math.round(maxAge / 86_400)} days, including subdomains.` }
    },
  },
  {
    id: 'xfo',
    header: 'X-Frame-Options',
    label: 'X-Frame-Options',
    penalty: 20,
    detail:
      'Stops other sites embedding yours in a frame, which is what makes clickjacking possible.',
    example: 'X-Frame-Options: DENY',
    docs: `${MDN}/X-Frame-Options`,
    satisfiedBy(ctx) {
      const csp = ctx.headers['content-security-policy']
      if (csp && /frame-ancestors/i.test(csp)) {
        return 'Covered by the frame-ancestors directive in your Content-Security-Policy.'
      }
      return null
    },
    evaluate(value) {
      if (/allow-from/i.test(value)) {
        return {
          status: 'warn',
          detail: 'ALLOW-FROM is obsolete and ignored by every current browser.',
          advice: "Use Content-Security-Policy: frame-ancestors instead.",
        }
      }
      if (!/^(deny|sameorigin)$/i.test(value.trim())) {
        return { status: 'warn', detail: `Unrecognised value "${value}".`, advice: 'Use DENY or SAMEORIGIN.' }
      }
      return { status: 'pass', detail: `Framing restricted to ${value.trim().toUpperCase()}.` }
    },
  },
  {
    id: 'xcto',
    header: 'X-Content-Type-Options',
    label: 'X-Content-Type-Options',
    penalty: 20,
    detail:
      'Stops browsers guessing a response type and executing an upload that was never meant to be script.',
    example: 'X-Content-Type-Options: nosniff',
    docs: `${MDN}/X-Content-Type-Options`,
    evaluate(value) {
      if (!/nosniff/i.test(value)) {
        return { status: 'warn', detail: `Got "${value}" - the only valid value is nosniff.` }
      }
      return { status: 'pass', detail: 'MIME sniffing disabled.' }
    },
  },
  {
    id: 'referrer',
    header: 'Referrer-Policy',
    label: 'Referrer Policy',
    penalty: 5,
    detail: 'Controls how much of the current URL is leaked to sites your users click through to.',
    example: 'Referrer-Policy: strict-origin-when-cross-origin',
    docs: `${MDN}/Referrer-Policy`,
    evaluate(value) {
      if (/unsafe-url/i.test(value)) {
        return {
          status: 'warn',
          detail: 'unsafe-url sends the full URL, including paths and query strings, to any origin.',
          advice: 'Use strict-origin-when-cross-origin.',
        }
      }
      return { status: 'pass', detail: value }
    },
  },
  {
    id: 'permissions',
    header: 'Permissions-Policy',
    label: 'Permissions Policy',
    penalty: 5,
    detail:
      'Turns off browser features (camera, microphone, geolocation) that the site does not use, including inside embedded frames.',
    example: 'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    docs: `${MDN}/Permissions-Policy`,
    evaluate(value) {
      return { status: 'pass', detail: value }
    },
  },
]

const DISCLOSURE_HEADERS: Array<{ header: string; label: string }> = [
  { header: 'server', label: 'Server' },
  { header: 'x-powered-by', label: 'X-Powered-By' },
  { header: 'x-aspnet-version', label: 'X-AspNet-Version' },
  { header: 'x-aspnetmvc-version', label: 'X-AspNetMvc-Version' },
  { header: 'x-generator', label: 'X-Generator' },
  { header: 'x-drupal-cache', label: 'X-Drupal-Cache' },
  { header: 'x-runtime', label: 'X-Runtime' },
]

const DEPRECATED_HEADERS: Array<{ header: string; label: string; detail: string }> = [
  {
    header: 'x-xss-protection',
    label: 'X-XSS-Protection',
    detail:
      'The legacy XSS auditor was removed from every major browser and could itself be abused. Content-Security-Policy replaces it.',
  },
  {
    header: 'expect-ct',
    label: 'Expect-CT',
    detail:
      'Certificate Transparency is now enforced by default, so this header no longer does anything.',
  },
  {
    header: 'public-key-pins',
    label: 'Public-Key-Pins',
    detail: 'HPKP is obsolete and dangerous - a bad pin can lock users out of the site entirely.',
  },
]

function gradeFor(score: number, hasWarnings: boolean): string {
  if (score >= 100) return hasWarnings ? 'A' : 'A+'
  if (score >= 95) return 'A'
  if (score >= 75) return 'B'
  if (score >= 55) return 'C'
  if (score >= 35) return 'D'
  if (score >= 15) return 'E'
  return 'F'
}

function analyzeCookies(cookies: string[]): Finding | null {
  if (!cookies.length) return null

  const problems: string[] = []
  for (const cookie of cookies) {
    const name = cookie.split('=')[0]?.trim() ?? 'cookie'
    const missing: string[] = []
    if (!/;\s*secure/i.test(cookie)) missing.push('Secure')
    if (!/;\s*httponly/i.test(cookie)) missing.push('HttpOnly')
    if (!/;\s*samesite=/i.test(cookie)) missing.push('SameSite')
    if (missing.length) problems.push(`${name} is missing ${missing.join(', ')}`)
  }

  if (!problems.length) {
    return {
      id: 'cookies',
      header: 'Set-Cookie',
      label: 'Cookies',
      status: 'pass',
      detail: `All ${cookies.length} cookie${cookies.length === 1 ? '' : 's'} set Secure, HttpOnly and SameSite.`,
    }
  }

  return {
    id: 'cookies',
    header: 'Set-Cookie',
    label: 'Cookies',
    status: 'warn',
    detail: problems.join('. ') + '.',
    advice: 'Add Secure; HttpOnly; SameSite=Lax to any cookie that is not read by client-side JavaScript.',
  }
}

export async function handleSecurity(request: Request): Promise<Response> {
  const limited = rateLimit(clientKey(request, 'security'), { limit: 15 })
  if (!limited.ok) return error('Rate limit exceeded', 429, { retryAfter: limited.retryAfter })

  const url = new URL(request.url)
  const target = parseHttpUrl(url.searchParams.get('url') ?? '')
  if (!target) return error('Enter a valid http(s) URL')

  let hops: Hop[]
  try {
    hops = await followRedirects(target)
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Could not reach that URL', 502)
  }

  const final = hops[hops.length - 1]
  if (!final) return error('No response from that URL', 502)

  const headers = Object.fromEntries(
    Object.entries(final.headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  const https = final.url.startsWith('https:')
  const ctx: Context = { headers, https }

  const findings: Finding[] = []
  const missing: MissingHeader[] = []
  const warnings: Finding[] = []
  let score = 100

  if (!https) {
    score -= 25
    warnings.push({
      id: 'no-https',
      header: 'TLS',
      label: 'Served over plain HTTP',
      status: 'fail',
      detail: 'Traffic to this URL is unencrypted and can be read or modified in transit.',
      advice: 'Redirect all HTTP traffic to HTTPS and enable HSTS.',
    })
  }

  for (const definition of DEFINITIONS) {
    const value = headers[definition.header.toLowerCase()]

    if (!value) {
      const substitute = definition.satisfiedBy?.(ctx)
      if (substitute) {
        findings.push({
          id: definition.id,
          header: definition.header,
          label: definition.label,
          status: 'pass',
          detail: substitute,
          docs: definition.docs,
        })
        continue
      }

      // HSTS on HTTP is meaningless - don't double-penalise.
      const penalty = definition.id === 'hsts' && !https ? 0 : definition.penalty
      score -= penalty
      missing.push({
        header: definition.header,
        label: definition.label,
        detail: definition.detail,
        example: definition.example,
        docs: definition.docs,
        penalty,
      })
      continue
    }

    const evaluated = definition.evaluate?.(value, ctx) ?? {
      status: 'pass' as const,
      detail: value,
    }

    findings.push({
      id: definition.id,
      header: definition.header,
      label: definition.label,
      status: evaluated.status,
      value,
      detail: evaluated.detail,
      advice: evaluated.advice,
      docs: definition.docs,
    })

    if (evaluated.status === 'warn') score -= 5
  }

  const cookieFinding = analyzeCookies(final.setCookies)
  if (cookieFinding) {
    findings.push(cookieFinding)
    if (cookieFinding.status === 'warn') score -= 5
  }

  for (const item of DEPRECATED_HEADERS) {
    const value = headers[item.header]
    if (!value) continue
    warnings.push({
      id: `deprecated-${item.header}`,
      header: item.label,
      label: `${item.label} is deprecated`,
      status: 'warn',
      value,
      detail: item.detail,
      advice: 'Remove the header.',
    })
  }

  const disclosures: Finding[] = []
  for (const item of DISCLOSURE_HEADERS) {
    const value = headers[item.header]
    if (!value) continue
    const versioned = /\d+\.\d+/.test(value)
    disclosures.push({
      id: `disclosure-${item.header}`,
      header: item.label,
      label: item.label,
      status: versioned ? 'warn' : 'info',
      value,
      detail: versioned
        ? 'Exposes an exact version, which makes it trivial to match against known CVEs.'
        : 'Reveals the software behind this site.',
    })
  }
  if (disclosures.some((d) => d.status === 'warn')) score -= 5

  const hasWarnings = warnings.length > 0 || findings.some((f) => f.status === 'warn')
  score = Math.max(0, Math.min(100, score))
  const grade = gradeFor(score, hasWarnings)

  const rawHeaders = Object.entries(final.headers)
    .filter(([key]) => key.toLowerCase() !== 'set-cookie')
    .concat(final.setCookies.map((cookie) => ['set-cookie', cookie] as [string, string]))
    .sort(([a], [b]) => a.localeCompare(b))

  const trackedHeaders = new Set([
    ...DEFINITIONS.map((d) => d.header.toLowerCase()),
    ...DEPRECATED_HEADERS.map((d) => d.header),
  ])

  return json({
    ok: true,
    data: {
      url: target.toString(),
      finalUrl: final.url,
      status: final.status,
      statusText: final.statusText,
      https,
      grade,
      score,
      findings,
      missing,
      warnings,
      disclosures,
      rawHeaders,
      securityHeaderNames: [...trackedHeaders],
      hops: hops.map((hop) => ({
        url: hop.url,
        status: hop.status,
        statusText: hop.statusText,
        redirectedTo: hop.redirectedTo,
        timingMs: hop.timingMs,
      })),
      checkedAt: new Date().toISOString(),
    },
  })
}
