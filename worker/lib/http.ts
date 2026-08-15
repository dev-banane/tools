export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function error(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, { status })
}
