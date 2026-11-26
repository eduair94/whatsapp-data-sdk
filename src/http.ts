import type { Channel, ResolvedConfig } from './config.js'
import {
  AuthError,
  HttpError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  WhatsAppDataError,
} from './errors.js'
import { buildQuery, type QueryValue } from './utils.js'

export type HttpMethod = 'GET' | 'POST'

export interface RequestOptions {
  method?: HttpMethod
  /**
   * Query params (booleans become the API's `"1"` flags; arrays are sent as
   * the key repeated per item).
   */
  query?: Record<string, QueryValue>
  /** JSON request body (POST). */
  body?: unknown
  /** `'json'` (default) parses JSON; `'bytes'` returns raw binary. */
  accept?: 'json' | 'bytes'
  /** Treat 404 as a normal result (don't throw). Used for cache misses. */
  allow404?: boolean
  /** Override the retry count for this call. */
  retries?: number
  /** Override the timeout (ms) for this call. */
  timeoutMs?: number
  /** Caller cancellation signal, combined with the internal timeout. */
  signal?: AbortSignal
}

export interface RawResponse<T = unknown> {
  status: number
  ok: boolean
  headers: Headers
  data: T
  bytes: Uint8Array
  contentType: string
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** URL with the query string removed — safe to put in errors/logs. */
const redactUrl = (url: string): string => url.split('?')[0] ?? url

/** Upper bound on the `retryAfterMs` an error reports. */
const MAX_RETRY_AFTER_MS = 60_000
/** Longest wait a `Retry-After` imposes before an automatic retry. */
const MAX_RETRY_WAIT_MS = 30_000

/**
 * Thin HTTP layer over `fetch`: builds URLs, injects auth headers, enforces a
 * timeout, retries transient failures, and maps responses to the SDK error
 * taxonomy.
 */
export class HttpTransport {
  constructor(private readonly config: ResolvedConfig) {}

  async request<T = unknown>(
    channel: Channel,
    path: string,
    options: RequestOptions = {}
  ): Promise<RawResponse<T>> {
    const {
      method = 'GET',
      query,
      body,
      accept = 'json',
      allow404 = false,
      timeoutMs = this.config.timeoutMs,
      signal,
    } = options

    // Non-idempotent POSTs are NOT auto-retried by default: a request the
    // server already processed but answered with a 5xx (or whose response was
    // lost) would be re-sent, double-spending quota. GET is safe to retry.
    const retries = Math.max(
      0,
      options.retries ?? (method === 'GET' ? this.config.retries : 0)
    )

    const url = channel.baseUrl + path + (query ? buildQuery(query) : '')

    const headers: Record<string, string> = {
      'x-rapidapi-key': this.config.apiKey,
      accept: accept === 'bytes' ? '*/*' : 'application/json',
      'user-agent': this.config.userAgent,
    }
    if (channel.host) headers['x-rapidapi-host'] = channel.host

    let payload: string | undefined
    if (body !== undefined && method !== 'GET') {
      payload = JSON.stringify(body)
      headers['content-type'] = 'application/json'
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(this.retryDelay(lastError, attempt))
      try {
        return await this.attempt<T>(url, {
          method,
          headers,
          body: payload,
          accept,
          allow404,
          timeoutMs,
          signal,
        })
      } catch (err) {
        lastError = err
        if (!this.isRetryable(err) || attempt === retries) throw err
      }
    }
    // Unreachable — the loop either returns or throws — but satisfies TS.
    throw lastError instanceof Error
      ? lastError
      : new WhatsAppDataError('Request failed')
  }

  private async attempt<T>(
    url: string,
    init: {
      method: HttpMethod
      headers: Record<string, string>
      body?: string
      accept: 'json' | 'bytes'
      allow404: boolean
      timeoutMs: number
      signal?: AbortSignal
    }
  ): Promise<RawResponse<T>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), init.timeoutMs)

    // Link the caller's signal so an external cancel aborts this request too.
    const onExternalAbort = () => controller.abort()
    if (init.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', onExternalAbort)
    }

    // The timer/signal stay armed across BOTH the fetch and the body read, so a
    // slow or hung response body is bounded by timeoutMs too (not just headers).
    try {
      let response: Response
      try {
        response = await this.config.fetchImpl(url, {
          method: init.method,
          headers: init.headers,
          body: init.body,
          signal: controller.signal,
        })
      } catch (err) {
        throw this.toTransportError(err, url, init.signal)
      }

      const contentType = response.headers.get('content-type') ?? ''
      let buffer: Uint8Array
      try {
        buffer = new Uint8Array(await response.arrayBuffer())
      } catch (err) {
        throw this.toTransportError(err, url, init.signal)
      }

      const data: unknown =
        init.accept === 'bytes' ? buffer : decodeJson(buffer, contentType)

      const raw: RawResponse<T> = {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        data: data as T,
        bytes: buffer,
        contentType,
      }

      if (response.ok || (response.status === 404 && init.allow404)) {
        return raw
      }

      // For a non-ok response, always surface a decoded JSON error body (even in
      // 'bytes' mode) so `error.body` carries the server's message, not raw bytes.
      const errorBody =
        init.accept === 'bytes' ? decodeJson(buffer, contentType) : data
      throw this.toHttpError(
        response.status,
        errorBody,
        redactUrl(url),
        response.headers
      )
    } finally {
      clearTimeout(timer)
      if (init.signal) init.signal.removeEventListener('abort', onExternalAbort)
    }
  }

  /** Map a thrown fetch/body-read error to a Timeout, Cancel, or Network error. */
  private toTransportError(
    err: unknown,
    url: string,
    callerSignal?: AbortSignal
  ): WhatsAppDataError {
    if (isAbortError(err)) {
      // If the caller aborted (not our timeout), surface it as a plain
      // cancellation rather than a misleading timeout.
      if (callerSignal?.aborted) {
        return new WhatsAppDataError('Request aborted by caller', {
          url: redactUrl(url),
          cause: err,
        })
      }
      return new TimeoutError(
        `Request timed out after ${this.config.timeoutMs}ms`,
        { url: redactUrl(url), cause: err }
      )
    }
    return new NetworkError(`Network request failed: ${errMessage(err)}`, {
      url: redactUrl(url),
      cause: err,
    })
  }

  private toHttpError(
    status: number,
    body: unknown,
    url: string,
    headers?: Headers
  ): HttpError {
    const detail = extractMessage(body) ?? `HTTP ${status}`
    if (status === 401 || status === 403) {
      return new AuthError(`Authentication failed: ${detail}`, {
        status,
        body,
        url,
      })
    }
    if (status === 429) {
      return new RateLimitError(`Rate limit exceeded: ${detail}`, {
        status,
        body,
        url,
        retryAfterMs: parseRetryAfter(headers?.get('retry-after')),
      })
    }
    return new HttpError(`Request failed (${status}): ${detail}`, {
      status,
      body,
      url,
      retryAfterMs:
        status === 503 ? parseRetryAfter(headers?.get('retry-after')) : undefined,
    })
  }

  /**
   * Wait before retry number `attempt`: the server's `Retry-After` on a 429 or
   * 503 (at most MAX_RETRY_WAIT_MS), else exponential backoff from
   * `retryDelayMs`.
   */
  private retryDelay(err: unknown, attempt: number): number {
    if (
      err instanceof HttpError &&
      (err.status === 429 || err.status === 503) &&
      err.retryAfterMs !== undefined
    ) {
      return Math.min(err.retryAfterMs, MAX_RETRY_WAIT_MS)
    }
    return this.config.retryDelayMs * 2 ** (attempt - 1)
  }

  private isRetryable(err: unknown): boolean {
    // Caller cancellation is never retried.
    if (err instanceof TimeoutError) return true
    if (err instanceof NetworkError) return true
    if (err instanceof RateLimitError) return true
    // A 504 TOO_BROAD (search too broad to finish in time) fails the same way
    // again: the query needs more words or filters, not another attempt.
    if (err instanceof HttpError && err.status === 504 && errorCode(err.body) === 'TOO_BROAD') {
      return false
    }
    if (err instanceof HttpError && err.status && err.status >= 500) return true
    return false
  }
}

function decodeJson(bytes: Uint8Array, contentType: string): unknown {
  const text = new TextDecoder().decode(bytes)
  if (!text) return undefined
  if (contentType.includes('application/json') || looksLikeJson(text)) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

const looksLikeJson = (text: string): boolean => {
  const t = text.trimStart()
  return t.startsWith('{') || t.startsWith('[')
}

function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'string') return body.slice(0, 300)
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    for (const key of ['error', 'message', 'detail', 'msg']) {
      if (typeof b[key] === 'string') return b[key] as string
    }
  }
  return undefined
}

/** The API's error `code` from a JSON error body, if any. */
function errorCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const code = (body as Record<string, unknown>).code
    if (typeof code === 'string') return code
  }
  return undefined
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into ms. */
function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return Math.min(parseInt(trimmed, 10) * 1000, MAX_RETRY_AFTER_MS)
  }
  const when = Date.parse(trimmed)
  if (!Number.isNaN(when)) {
    const delta = when - Date.now()
    if (delta > 0) return Math.min(delta, MAX_RETRY_AFTER_MS)
  }
  return undefined
}

const isAbortError = (err: unknown): boolean =>
  !!err &&
  typeof err === 'object' &&
  (err as { name?: string }).name === 'AbortError'

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
