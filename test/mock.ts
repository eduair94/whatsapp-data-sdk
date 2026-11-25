import type { FetchLike } from '../src/index.js'

export interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

export interface MockResponse {
  status?: number
  json?: unknown
  bytes?: Uint8Array
  contentType?: string
  /** Extra response headers (e.g. `retry-after`). */
  headers?: Record<string, string>
}

/**
 * A `fetch` mock that returns queued responses in order and records every
 * call. When the queue is exhausted the last response repeats.
 */
export function mockFetch(responses: MockResponse[]): {
  fetch: FetchLike
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []
  let index = 0

  const fetchImpl: FetchLike = async (url, init) => {
    const headers: Record<string, string> = {}
    const h = init?.headers as Record<string, string> | undefined
    if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = v

    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    })

    const spec = responses[Math.min(index, responses.length - 1)] ?? {}
    index++
    const status = spec.status ?? 200
    const contentType =
      spec.contentType ?? (spec.bytes ? 'image/jpeg' : 'application/json')

    const payload: BodyInit = spec.bytes
      ? (spec.bytes as unknown as BodyInit)
      : spec.json !== undefined
        ? JSON.stringify(spec.json)
        : ''

    return new Response(payload, {
      status,
      headers: { 'content-type': contentType, ...(spec.headers ?? {}) },
    })
  }

  return { fetch: fetchImpl, calls }
}
