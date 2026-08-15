import type { Env } from './env'
import { error, json } from './lib/http'
import { handleDns } from './routes/dns'
import { handleHeaders } from './routes/headers'
import { handleIp, handleTile } from './routes/ip'
import { handleResolve } from './routes/resolve'
import { handleSecurity } from './routes/security'
import { handleSubdomains } from './routes/subdomains'
import { handleTtfb } from './routes/ttfb'

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  return {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  }
}

function withCors(request: Request, response: Response) {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders(request))) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 404 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method !== 'GET') {
      return withCors(request, error('Method not allowed', 405))
    }

    try {
      let response: Response

      switch (url.pathname) {
        case '/api/health':
          response = json({ ok: true, service: 'devjakob-tools' })
          break
        case '/api/ip':
          response = await handleIp(request)
          break
        case '/api/tile':
          response = await handleTile(request)
          break
        case '/api/dns':
          response = await handleDns(request)
          break
        case '/api/headers':
          response = await handleHeaders(request)
          break
        case '/api/ttfb':
          response = await handleTtfb(request)
          break
        case '/api/security':
          response = await handleSecurity(request)
          break
        case '/api/subdomains':
          response = await handleSubdomains(request)
          break
        case '/api/resolve':
          response = await handleResolve(request)
          break
        default:
          response = error('Not found', 404)
      }

      return withCors(request, response)
    } catch (err) {
      return withCors(
        request,
        error(err instanceof Error ? err.message : 'Internal error', 500),
      )
    }
  },
} satisfies ExportedHandler<Env>
