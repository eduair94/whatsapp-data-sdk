/**
 * whatsapp-data-sdk — TypeScript client for the WhatsApp Data API.
 *
 * @packageDocumentation
 */
export { WhatsAppDataClient } from './client.js'
export type { CachedLookupResult } from './client.js'

export {
  resolveConfig,
  PROXY_BASE_URL,
  RAPIDAPI_LIVE_HOST,
  RAPIDAPI_CACHE_HOST,
} from './config.js'
export type {
  WhatsAppDataClientOptions,
  Transport,
  Channel,
  ResolvedConfig,
  FetchLike,
} from './config.js'

export {
  WhatsAppDataError,
  HttpError,
  AuthError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ValidationError,
} from './errors.js'

export { toDigits, toE164 } from './utils.js'

export * from './types/index.js'
