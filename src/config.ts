import { ValidationError } from './errors.js'

/** A `fetch`-compatible function. Lets callers inject a polyfill or a mock. */
export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>

/**
 * Which host family to talk to:
 * - `proxy` (default): the free `whatsapp-proxy.checkleaked.cc` reverse proxy.
 *   One base URL; the cache lookup is distinguished by path (`/number_cache`).
 * - `rapidapi`: the RapidAPI marketplace. Live traffic goes to
 *   `whatsapp-number-validator18.p.rapidapi.com`; cache/DB-only traffic to
 *   `wp-data-db-only.p.rapidapi.com`. Both require the `x-rapidapi-host` header.
 */
export type Transport = 'proxy' | 'rapidapi'

export interface WhatsAppDataClientOptions {
  /** Your API key, sent as `x-rapidapi-key`. Required. */
  apiKey: string
  /** Host family. Default `'proxy'`. */
  transport?: Transport
  /** Override the live base URL (e.g. a self-hosted proxy). */
  baseUrl?: string
  /** Override the cache/DB-only base URL. */
  cacheBaseUrl?: string
  /** Override the live `x-rapidapi-host` header (rapidapi transport). */
  rapidApiHost?: string
  /** Override the cache `x-rapidapi-host` header (rapidapi transport). */
  rapidApiCacheHost?: string
  /** Per-request timeout in ms. Default 60000. */
  timeoutMs?: number
  /**
   * Retry attempts on transient failures (5xx / 429 / network / timeout).
   * Applies to idempotent GETs only — POSTs are not auto-retried. A `504`
   * `TOO_BROAD` is never retried. Default 2.
   */
  retries?: number
  /**
   * Base backoff between retries in ms (exponential). Default 500. A `429` or
   * `503` with `Retry-After` waits that long instead (at most 30 s).
   */
  retryDelayMs?: number
  /** Custom `User-Agent`. */
  userAgent?: string
  /** Inject a custom `fetch` implementation (defaults to the global one). */
  fetch?: FetchLike
}

/** A resolved endpoint target: base URL plus optional RapidAPI host header. */
export interface Channel {
  baseUrl: string
  host?: string
}

export interface ResolvedConfig {
  apiKey: string
  transport: Transport
  live: Channel
  cache: Channel
  timeoutMs: number
  retries: number
  retryDelayMs: number
  userAgent: string
  fetchImpl: FetchLike
}

export const PROXY_BASE_URL = 'https://whatsapp-proxy.checkleaked.cc'
export const RAPIDAPI_LIVE_HOST = 'whatsapp-number-validator18.p.rapidapi.com'
export const RAPIDAPI_CACHE_HOST = 'wp-data-db-only.p.rapidapi.com'
export const DEFAULT_USER_AGENT = 'whatsapp-data-sdk/1.5.0 (+https://npm.im/whatsapp-data-sdk)'

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

export function resolveConfig(
  options: WhatsAppDataClientOptions
): ResolvedConfig {
  if (!options || typeof options.apiKey !== 'string' || !options.apiKey.trim()) {
    throw new ValidationError('apiKey is required')
  }

  const transport: Transport = options.transport ?? 'proxy'
  if (transport !== 'proxy' && transport !== 'rapidapi') {
    throw new ValidationError(
      `Invalid transport: ${JSON.stringify(transport)}. Expected 'proxy' or 'rapidapi'.`
    )
  }

  let live: Channel
  let cache: Channel

  if (transport === 'rapidapi') {
    const liveHost = options.rapidApiHost ?? RAPIDAPI_LIVE_HOST
    const cacheHost = options.rapidApiCacheHost ?? RAPIDAPI_CACHE_HOST
    live = {
      baseUrl: stripTrailingSlash(options.baseUrl ?? `https://${liveHost}`),
      host: liveHost,
    }
    cache = {
      baseUrl: stripTrailingSlash(
        options.cacheBaseUrl ?? `https://${cacheHost}`
      ),
      host: cacheHost,
    }
  } else {
    const base = stripTrailingSlash(options.baseUrl ?? PROXY_BASE_URL)
    live = { baseUrl: base }
    // On the proxy, the cache lookup is the same host, differentiated by path.
    cache = { baseUrl: stripTrailingSlash(options.cacheBaseUrl ?? base) }
  }

  // Bind the global fetch to globalThis. Called later as `this.config.fetchImpl`
  // (a method reference), an unbound browser `window.fetch` would otherwise
  // throw "Illegal invocation". A caller-supplied fetch is used as-is.
  const globalFetch =
    typeof globalThis.fetch === 'function'
      ? (globalThis.fetch.bind(globalThis) as FetchLike)
      : undefined
  const fetchImpl = options.fetch ?? globalFetch
  if (typeof fetchImpl !== 'function') {
    throw new ValidationError(
      'No fetch implementation available. Use Node >=18, or pass `fetch` in the client options.'
    )
  }

  return {
    apiKey: options.apiKey.trim(),
    transport,
    live,
    cache,
    timeoutMs: options.timeoutMs ?? 60000,
    retries: options.retries ?? 2,
    retryDelayMs: options.retryDelayMs ?? 500,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    fetchImpl,
  }
}
