/**
 * Error taxonomy for the SDK. Every failure surfaces as a
 * {@link WhatsAppDataError} (or a subclass), so a single `catch` can handle
 * transport, HTTP and validation problems uniformly.
 */

/** Base error for all SDK failures. */
export class WhatsAppDataError extends Error {
  /** HTTP status code, or `undefined` for transport-level failures. */
  readonly status?: number
  /** Parsed response body (when available). */
  readonly body?: unknown
  /** The request URL that failed (query string stripped of secrets). */
  readonly url?: string

  constructor(
    message: string,
    options: { status?: number; body?: unknown; url?: string; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause })
    this.name = 'WhatsAppDataError'
    this.status = options.status
    this.body = options.body
    this.url = options.url
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** A non-2xx HTTP response. */
export class HttpError extends WhatsAppDataError {
  constructor(
    message: string,
    options: { status: number; body?: unknown; url?: string }
  ) {
    super(message, options)
    this.name = 'HttpError'
  }
}

/** Authentication failed — missing, invalid, or unsubscribed API key (401/403). */
export class AuthError extends HttpError {
  constructor(
    message: string,
    options: { status: number; body?: unknown; url?: string }
  ) {
    super(message, options)
    this.name = 'AuthError'
  }
}

/** Rate limit exceeded (429). */
export class RateLimitError extends HttpError {
  /** Milliseconds to wait before retrying, parsed from the `Retry-After` header (if any). */
  readonly retryAfterMs?: number

  constructor(
    message: string,
    options: {
      status: number
      body?: unknown
      url?: string
      retryAfterMs?: number
    }
  ) {
    super(message, options)
    this.name = 'RateLimitError'
    this.retryAfterMs = options.retryAfterMs
  }
}

/** A transport failure (timeout, DNS, connection reset) — no HTTP response. */
export class NetworkError extends WhatsAppDataError {
  constructor(message: string, options: { url?: string; cause?: unknown } = {}) {
    super(message, options)
    this.name = 'NetworkError'
  }
}

/** The request timed out before a response arrived. */
export class TimeoutError extends NetworkError {
  constructor(message: string, options: { url?: string; cause?: unknown } = {}) {
    super(message, options)
    this.name = 'TimeoutError'
  }
}

/** Invalid arguments supplied to an SDK method. */
export class ValidationError extends WhatsAppDataError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
