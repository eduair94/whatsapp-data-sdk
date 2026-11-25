import {
  resolveConfig,
  type ResolvedConfig,
  type WhatsAppDataClientOptions,
} from './config.js'
import { HttpTransport, type RequestOptions } from './http.js'
import { toDigits, toE164 } from './utils.js'
import { ValidationError } from './errors.js'
import type {
  BreachOptions,
  BulkDbResponse,
  BulkLiveOptions,
  BulkLiveResponse,
  CarrierAltOptions,
  CarrierAltResponse,
  CarrierLookupResponse,
  CheckCachedOptions,
  DeviceCountResponse,
  DriveFolderInfoResponse,
  ExternalBreachesResponse,
  FacebookLeakSearchParams,
  FacebookLeakSearchResponse,
  GetProfileNoPictureOptions,
  GetProfileOptions,
  OsintInfoResponse,
  PaginatedResponse,
  PhoneBreachesResponse,
  PictureResult,
  ProximitySearchParams,
  ProximitySearchResponse,
  RequestConfig,
  SearchParams,
  TelegramCheckResponse,
  WhatsAppEntry,
} from './types/index.js'

/** A cache-aware lookup result — the entry tagged with where it came from. */
export type CachedLookupResult = WhatsAppEntry & {
  /** `'cache'` when served from the DB, `'live'` when freshly fetched. */
  _source: 'cache' | 'live'
}

/**
 * Client for the WhatsApp Data API.
 *
 * ```ts
 * const client = new WhatsAppDataClient({ apiKey: process.env.RAPIDAPI_KEY! })
 * const profile = await client.getProfile('59898297150')
 * ```
 *
 * The default `proxy` transport talks to `whatsapp-proxy.checkleaked.cc`. Pass
 * `transport: 'rapidapi'` to use the `wp-data` / `wp-data-db-only` RapidAPI
 * hosts instead.
 *
 * Every method accepts a trailing options object extending {@link RequestConfig}
 * (`signal`, `timeoutMs`, `retries`) for per-call cancellation and tuning.
 */
export class WhatsAppDataClient {
  private readonly config: ResolvedConfig
  private readonly http: HttpTransport

  constructor(options: WhatsAppDataClientOptions) {
    this.config = resolveConfig(options)
    this.http = new HttpTransport(this.config)
  }

  /* ── Profile ────────────────────────────────────────────────────────── */

  /**
   * **Get Profile Information** — full WhatsApp lookup for a number, with
   * optional enrichments (Telegram, Google, carrier, face analysis, …).
   * `GET /number/:number`
   *
   * A number that isn't on WhatsApp resolves with `exists:false` (and
   * `code:"NUMBER_NOT_FOUND"`) — it does NOT throw. An invalid number (400),
   * auth failure (401/403), or server error (5xx) throws.
   */
  async getProfile(
    number: string,
    options: GetProfileOptions = {}
  ): Promise<WhatsAppEntry> {
    const { data } = await this.http.request<WhatsAppEntry>(
      this.config.live,
      `/number/${toDigits(number)}`,
      { query: profileQuery(options), allow404: true, ...rc(options) }
    )
    return data
  }

  /**
   * **Get Profile Information (No profile pic)** — same as {@link getProfile}
   * but skips profile-picture processing for a faster response. Only the
   * `telegram`, `lookup` and `google` enrichments apply here.
   * `GET /number/no_picture/:number`
   */
  async getProfileNoPicture(
    number: string,
    options: GetProfileNoPictureOptions = {}
  ): Promise<WhatsAppEntry> {
    const { data } = await this.http.request<WhatsAppEntry>(
      this.config.live,
      `/number/no_picture/${toDigits(number)}`,
      {
        query: {
          telegram: options.telegram,
          lookup: options.lookup,
          google: options.google,
        },
        allow404: true,
        ...rc(options),
      }
    )
    return data
  }

  /**
   * **Get Last Saved Picture** — the most recently stored profile picture as
   * raw JPEG bytes. Throws an {@link HttpError} with `status:404` when the
   * number has no stored picture. `GET /picture/:phonenumber`
   */
  async getLastPicture(
    number: string,
    options: RequestConfig = {}
  ): Promise<PictureResult> {
    const res = await this.http.request<Uint8Array>(
      this.config.live,
      `/picture/${toDigits(number)}`,
      { accept: 'bytes', ...rc(options) }
    )
    const contentType = res.contentType || 'image/jpeg'
    const bytes = res.bytes
    return {
      bytes,
      contentType,
      toDataUri(): string {
        return `data:${contentType};base64,${base64FromBytes(bytes)}`
      },
    }
  }

  /**
   * **Device count** — number of devices linked to the WhatsApp account, plus
   * history. For a number not on WhatsApp the API returns `success:false`
   * (with `deviceCount` absent) rather than throwing. `GET /device_count/:number`
   */
  async getDeviceCount(
    number: string,
    options: RequestConfig = {}
  ): Promise<DeviceCountResponse> {
    const { data } = await this.http.request<DeviceCountResponse>(
      this.config.live,
      `/device_count/${toDigits(number)}`,
      { allow404: true, ...rc(options) }
    )
    return data
  }

  /**
   * **OSINT Info** — device/business OSINT summary for a number.
   * `GET /osint/info/:number`
   */
  async getOsintInfo(
    number: string,
    options: RequestConfig = {}
  ): Promise<OsintInfoResponse> {
    const { data } = await this.http.request<OsintInfoResponse>(
      this.config.live,
      `/osint/info/${toDigits(number)}`,
      { allow404: true, ...rc(options) }
    )
    return data
  }

  /* ── Breaches ───────────────────────────────────────────────────────── */

  /**
   * **Get Phone Breaches (No external api key required)** — data-breach lookup
   * via the built-in LeakCheck Pro integration. `GET /leakcheck/:number`
   */
  async getPhoneBreaches(
    number: string,
    options: BreachOptions = {}
  ): Promise<PhoneBreachesResponse> {
    const { data } = await this.http.request<PhoneBreachesResponse>(
      this.config.live,
      `/leakcheck/${toDigits(number)}`,
      { query: { limit: options.limit, offset: options.offset }, ...rc(options) }
    )
    return data
  }

  /**
   * **Get Phone Breaches** — data-breach lookup via the legacy checkleaked.cc
   * service, using *your own* external API key. `GET /check_leaks/:number`
   */
  async getPhoneBreachesExternal(
    number: string,
    apiKey: string,
    options: RequestConfig = {}
  ): Promise<ExternalBreachesResponse> {
    if (!apiKey || !apiKey.trim()) {
      throw new ValidationError('apiKey is required for getPhoneBreachesExternal')
    }
    const { data } = await this.http.request<ExternalBreachesResponse>(
      this.config.live,
      `/check_leaks/${toDigits(number)}`,
      { query: { apiKey }, ...rc(options) }
    )
    return data
  }

  /* ── Search & Database ──────────────────────────────────────────────── */

  /**
   * **Search** — advanced search over the phone-number database with filters
   * (country, business, WhatsApp username, face analysis, date range, …).
   * Zero matches resolve to an empty page (`success:false`, `data.docs:[]`)
   * rather than throwing. `GET /phone-numbers/search`
   */
  async search(
    params: SearchParams = {}
  ): Promise<PaginatedResponse<WhatsAppEntry>> {
    const { data } = await this.http.request<PaginatedResponse<WhatsAppEntry>>(
      this.config.live,
      '/phone-numbers/search',
      { query: searchQuery(params), allow404: true, ...rc(params) }
    )
    return data
  }

  /**
   * **Search in Google Maps** — find WhatsApp *business* numbers within a
   * geographic radius of a lat/long point. `GET /phone-numbers/proximity/search`
   */
  async searchGoogleMaps(
    params: ProximitySearchParams
  ): Promise<ProximitySearchResponse> {
    if (
      typeof params?.latitude !== 'number' ||
      typeof params?.longitude !== 'number'
    ) {
      throw new ValidationError(
        'searchGoogleMaps requires numeric latitude and longitude'
      )
    }
    const { data } = await this.http.request<ProximitySearchResponse>(
      this.config.live,
      '/phone-numbers/proximity/search',
      {
        query: {
          latitude: params.latitude,
          longitude: params.longitude,
          radius: params.radius,
          page: params.page,
          limit: params.limit,
        },
        ...rc(params),
      }
    )
    return data
  }

  /**
   * **Facebook leak search** — search the 2019 Facebook leak by name, email,
   * location, workplace or phone number. Each row is crossed with the
   * WhatsApp cache by number (`whatsapp`, cache-only — never a live lookup)
   * unless `whatsapp:false`. One credit per successful page.
   * `GET /facebook-leak/search`
   *
   * **Direct API keys only** (the default `proxy` transport). It is not
   * available on RapidAPI: on the `rapidapi` transport the API answers `403`
   * (`code:'ENDPOINT_UNAVAILABLE'`), which surfaces as an {@link AuthError}.
   *
   * Errors carry the API's `code` in `error.body.code`:
   * - `400` {@link HttpError} — `INVALID_PARAMETER`, `INVALID_NUMBER` or
   *   `INVALID_QUERY` (out-of-range values are refused, not clamped).
   * - `429` {@link RateLimitError} — `RATE_LIMITED` (30/min and 2,000/day per
   *   key); `retryAfterMs` comes from `Retry-After`.
   * - `502` `UPSTREAM_ERROR`, `503` `BUSY`, `504` `TOO_BROAD` (add words, a
   *   `field` or `countryCode`) — {@link HttpError}. Like every 5xx on a GET
   *   they are retried per `retries`; pass `retries: 0` to fail fast.
   */
  async searchFacebookLeak(
    params: FacebookLeakSearchParams = {}
  ): Promise<FacebookLeakSearchResponse> {
    const { data } = await this.http.request<FacebookLeakSearchResponse>(
      this.config.live,
      '/facebook-leak/search',
      {
        query: {
          q: params.q,
          field: params.field,
          number: params.number,
          countryCode: params.countryCode,
          gender: params.gender,
          hasEmail: tri(params.hasEmail),
          whatsapp: tri(params.whatsapp),
          page: params.page,
          limit: params.limit,
        },
        ...rc(params),
      }
    )
    return data
  }

  /**
   * **Leaked Numbers (500M database)** — get access to the full leaked-numbers
   * dataset. Returns a JSON payload with a Google Drive folder link to the
   * data (not the rows inline). `GET /leaks/info`
   *
   * **MEGA tier only** — requires a key on the 500k+ request plan; lower tiers
   * receive a 403 ({@link AuthError}).
   */
  async getLeakedNumbersInfo(
    options: RequestConfig = {}
  ): Promise<DriveFolderInfoResponse> {
    const { data } = await this.http.request<DriveFolderInfoResponse>(
      this.config.live,
      '/leaks/info',
      { ...rc(options) }
    )
    return data
  }

  /**
   * **Download the Entire DB** — get access to the full database backup.
   * Returns a JSON payload with a Google Drive folder link to the backup
   * archive. `GET /backup/info`
   *
   * **MEGA tier only** — requires a key on the 500k+ request plan; lower tiers
   * receive a 403 ({@link AuthError}).
   */
  async downloadEntireDatabase(
    options: RequestConfig = {}
  ): Promise<DriveFolderInfoResponse> {
    const { data } = await this.http.request<DriveFolderInfoResponse>(
      this.config.live,
      '/backup/info',
      { ...rc(options) }
    )
    return data
  }

  /* ── Bulk ───────────────────────────────────────────────────────────── */

  /**
   * **Bulk Check** — live WhatsApp verification of many numbers at once
   * (max 50). `POST /bulk_check`
   */
  async bulkCheck(
    numbers: string[],
    options: BulkLiveOptions = {}
  ): Promise<BulkLiveResponse> {
    const list = normalizeList(numbers, toDigits, 50)
    const { data } = await this.http.request<BulkLiveResponse>(
      this.config.live,
      '/bulk_check',
      {
        method: 'POST',
        body: { numbers: list, includeBusiness: options.includeBusiness },
        query: {
          noBanStatus: options.noBanStatus,
          includeBusiness: options.includeBusiness,
        },
        ...rc(options),
      }
    )
    return data
  }

  /**
   * **Basic Check** — check many numbers against the database only (no live
   * WhatsApp calls), returning basic status. `POST /phone-numbers/bulk-check/basic`
   */
  async bulkCheckDbBasic(
    numbers: string[],
    options: RequestConfig = {}
  ): Promise<BulkDbResponse> {
    const { data } = await this.http.request<BulkDbResponse>(
      this.config.live,
      '/phone-numbers/bulk-check/basic',
      {
        method: 'POST',
        body: { numbers: normalizeList(numbers, toE164, 1000) },
        ...rc(options),
      }
    )
    return data
  }

  /**
   * **Full Check** — check many numbers against the database only, returning
   * the full DB record for each match. `POST /phone-numbers/bulk-check/full`
   */
  async bulkCheckDbFull(
    numbers: string[],
    options: RequestConfig = {}
  ): Promise<BulkDbResponse> {
    const { data } = await this.http.request<BulkDbResponse>(
      this.config.live,
      '/phone-numbers/bulk-check/full',
      {
        method: 'POST',
        body: { numbers: normalizeList(numbers, toE164, 1000), fullInfo: true },
        ...rc(options),
      }
    )
    return data
  }

  /* ── Telegram ───────────────────────────────────────────────────────── */

  /**
   * **Get Profile Information Telegram** *(experimental)* — check whether one
   * or more numbers are on Telegram and return their profile. `GET /telegram/check`
   */
  async getTelegramProfile(
    phones: string | string[],
    options: RequestConfig = {}
  ): Promise<TelegramCheckResponse> {
    const list = Array.isArray(phones) ? phones : [phones]
    const joined = list.map((p) => toDigits(p)).join(',')
    if (!joined) throw new ValidationError('At least one phone is required')
    const { data } = await this.http.request<TelegramCheckResponse>(
      this.config.live,
      '/telegram/check',
      { query: { phones: joined }, ...rc(options) }
    )
    return data
  }

  /* ── Carrier ────────────────────────────────────────────────────────── */

  /**
   * **Carrier Lookup** — carrier, line type and location for a number.
   * `GET /carrier/:number`
   */
  async carrierLookup(
    number: string,
    options: RequestConfig = {}
  ): Promise<CarrierLookupResponse> {
    const { data } = await this.http.request<CarrierLookupResponse>(
      this.config.live,
      `/carrier/${toDigits(number)}`,
      { ...rc(options) }
    )
    return data
  }

  /**
   * **Carrier Lookup Alternative** — carrier data from an alternative source,
   * including spam-report signals. The response carries a `pagination` block;
   * pass `{ page }` to page through reports. `GET /phone_data/:number`
   */
  async carrierLookupAlt(
    number: string,
    options: CarrierAltOptions = {}
  ): Promise<CarrierAltResponse> {
    const { data } = await this.http.request<CarrierAltResponse>(
      this.config.live,
      `/phone_data/${toDigits(number)}`,
      { query: { page: options.page }, ...rc(options) }
    )
    return data
  }

  /* ── Cache-aware lookup (money saver) ───────────────────────────────── */

  /**
   * Cheapest-first WhatsApp lookup.
   *
   * With the default `cacheFirst` mode this reads the cheap cache / DB-only
   * endpoint first and only falls back to a paid live check when the number
   * isn't cached yet — minimizing cost while still guaranteeing an answer.
   *
   * - `cacheFirst` (default): cache → live on miss.
   * - `cacheOnly`: cache only, never a live check.
   * - `live`: always a fresh live check.
   *
   * The returned entry carries `_source: 'cache' | 'live'`. An authoritative
   * cached "not on WhatsApp" record counts as a cache hit (no live re-check);
   * only a true DB miss (`NOT_IN_DATABASE`) falls through to live.
   */
  async checkCached(
    number: string,
    options: CheckCachedOptions = {}
  ): Promise<CachedLookupResult> {
    const mode = options.mode ?? 'cacheFirst'
    const digits = toDigits(number)
    const config = rc(options)

    if (mode === 'live') {
      const data = await this.getProfile(number, {
        telegram: options.telegram,
        ...config,
      })
      return tag(data, 'live')
    }

    // Read the cache/DB-only endpoint. On the proxy this is the same host with
    // a `/number_cache` path; on RapidAPI it's the `wp-data-db-only` host.
    const res = await this.http.request<WhatsAppEntry>(
      this.config.cache,
      `/number_cache/${digits}`,
      { query: { telegram: options.telegram }, allow404: true, ...config }
    )

    // A hit is any body that carries an actual record (`number`/`exists`) — even
    // an authoritative "not on WhatsApp" record. Only a bare DB-miss marker
    // (`{code:'NOT_IN_DATABASE'}`, or an empty/non-object body) is a real miss.
    if (isRealRecord(res.data) && !isCacheMiss(res.data)) {
      return tag(res.data, 'cache')
    }

    if (mode === 'cacheOnly') {
      // Synthesize a minimal entry so callers always get a usable shape.
      const missBody =
        res.data && typeof res.data === 'object' ? res.data : {}
      return tag({ number: digits, exists: false, ...missBody }, 'cache')
    }

    // cacheFirst → fall back to a live check.
    const data = await this.getProfile(number, {
      telegram: options.telegram,
      ...config,
    })
    return tag(data, 'live')
  }
}

/* ── helpers ──────────────────────────────────────────────────────────── */

/** Extract the shared per-request controls to forward to the transport. */
function rc(
  o: RequestConfig
): Pick<RequestOptions, 'signal' | 'timeoutMs' | 'retries'> {
  return { signal: o.signal, timeoutMs: o.timeoutMs, retries: o.retries }
}

function profileQuery(
  o: GetProfileOptions
): Record<string, string | number | boolean | undefined> {
  return {
    telegram: o.telegram,
    base64: o.base64,
    lookup: o.lookup,
    google: o.google,
    includeCarrier: o.includeCarrier,
    ignoreProfilePic: o.ignoreProfilePic,
    includeUpdatedPictureHistory: o.includeUpdatedPictureHistory,
    geminiFaceAnalysis: o.geminiFaceAnalysis,
    reverseImageSearch: o.reverseImageSearch,
    fullAiReport: o.fullAiReport,
    includeDeviceCount: o.includeDeviceCount,
    onlyCheck: o.onlyCheck,
    forceBypassCache: o.forceBypassCache,
    bypassProfilePicCache: o.bypassProfilePicCache,
    useCache: o.useCache,
    includeLeakCheckPro: o.includeLeakCheckPro,
    checkLeakedApiKey: o.checkLeakedApiKey,
    ip: o.ip,
  }
}

/**
 * Serialize a filter boolean as an explicit `"true"`/`"false"` string (NOT the
 * presence-only `"1"` flag), so a `false` filter like `isBusiness:false` is
 * actually sent instead of being dropped. `undefined` is omitted.
 */
function tri(v: boolean | undefined): string | undefined {
  return v === undefined ? undefined : v ? 'true' : 'false'
}

/** Build the search query; filter booleans go through {@link tri}. */
function searchQuery(
  p: SearchParams
): Record<string, string | number | boolean | undefined> {
  return {
    page: p.page,
    limit: p.limit,
    number: p.number,
    search: p.search,
    countryCode: p.countryCode,
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    dateFrom: p.dateFrom,
    dateTo: p.dateTo,
    faceGender: p.faceGender,
    faceMinAge: p.faceMinAge,
    faceMaxAge: p.faceMaxAge,
    facePeopleMin: p.facePeopleMin,
    facePeopleMax: p.facePeopleMax,
    username: p.username,
    hasUsername: tri(p.hasUsername),
    hasProfilePic: tri(p.hasProfilePic),
    isBusiness: tri(p.isBusiness),
    includeCount: tri(p.includeCount),
    hasFaceAnalysis: tri(p.hasFaceAnalysis),
    ...(p.extra ?? {}),
  }
}

function normalizeList(
  numbers: string[],
  normalize: (n: string) => string,
  max: number
): string[] {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new ValidationError('numbers must be a non-empty array')
  }
  if (numbers.length > max) {
    throw new ValidationError(
      `Too many numbers: ${numbers.length} (max ${max} per request)`
    )
  }
  return numbers.map(normalize)
}

function tag(
  entry: WhatsAppEntry,
  source: 'cache' | 'live'
): CachedLookupResult {
  return Object.assign({}, entry, { _source: source })
}

/** True when the body carries an actual number record (not a bare miss marker). */
function isRealRecord(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.number === 'string' || 'exists' in d
}

/**
 * Recognize a genuine cache/DB *miss* (number simply isn't stored yet).
 *
 * Only the `NOT_IN_DATABASE` sentinel counts. A `NUMBER_NOT_FOUND` code is NOT
 * a miss — it's an authoritative cached record meaning "we checked, this number
 * isn't on WhatsApp"; treating it as a miss would trigger a needless (paid)
 * live re-check on every lookup.
 */
function isCacheMiss(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true
  const d = data as Record<string, unknown>
  return typeof d.code === 'string' && /NOT_?IN_?DATABASE/i.test(d.code)
}

function base64FromBytes(bytes: Uint8Array): string {
  // Node: Buffer; browser/other: btoa fallback.
  const g = globalThis as {
    Buffer?: { from(b: Uint8Array): { toString(e: string): string } }
    btoa?: (s: string) => string
  }
  if (g.Buffer) return g.Buffer.from(bytes).toString('base64')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return g.btoa ? g.btoa(binary) : binary
}
