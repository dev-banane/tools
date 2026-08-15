export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok?: false; error: string; retryAfter?: number }

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '') url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  })

  const body = (await res.json().catch(() => ({}))) as ApiOk<T> | ApiErr

  if (!res.ok || !('ok' in body) || body.ok !== true) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? body.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }

  return body.data
}
