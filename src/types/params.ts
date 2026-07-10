/**
 * Request parameter / option types.
 *
 * Boolean options map to the API's `"1"` query flags internally, so callers
 * work with plain booleans.
 */

/** Sort direction shared across list/search endpoints. */
export type SortOrder = 'asc' | 'desc'

/**
 * Per-request controls accepted by every method (in addition to any
 * endpoint-specific options).
 */
export interface RequestConfig {
  /** Cancel this request (combined with the internal timeout). */
  signal?: AbortSignal
  /** Override the client's timeout (ms) for this call. */
  timeoutMs?: number
  /** Override the client's retry count for this call. */
  retries?: number
}

/** Enrichment flags for `getProfile` (`GET /number/:number`). */
export interface GetProfileOptions extends RequestConfig {
  /** Include a Telegram lookup for the number. */
  telegram?: boolean
  /** Return the profile picture as a base64 string on the entry. */
  base64?: boolean
  /** Include a TrueCaller lookup. */
  lookup?: boolean
  /** Include Google search results for the number. */
  google?: boolean
  /** Include phone carrier information. */
  includeCarrier?: boolean
  /** Skip profile-picture processing entirely (faster). */
  ignoreProfilePic?: boolean
  /** Include picture change history. */
  includeUpdatedPictureHistory?: boolean
  /** Run Gemini AI face analysis on the profile picture. */
  geminiFaceAnalysis?: boolean
  /** Run a Google Lens reverse-image search on the profile picture. */
  reverseImageSearch?: boolean
  /** Generate a full AI OSINT report (runs after other enrichments; slower). */
  fullAiReport?: boolean
  /** Include the number of linked devices. */
  includeDeviceCount?: boolean
  /** Quick existence check only — minimal payload, fastest. */
  onlyCheck?: boolean
  /** Bypass all caches and fetch fresh from WhatsApp. */
  forceBypassCache?: boolean
  /** Force re-download of the profile picture even if cached. */
  bypassProfilePicCache?: boolean
  /** Prefer cached data if available (faster, possibly stale). */
  useCache?: boolean
  /** Include LeakCheck Pro breach data (needs server-side key). */
  includeLeakCheckPro?: boolean
  /** API key for the legacy checkleaked.cc leak service. */
  checkLeakedApiKey?: string
  /** IP address (for localhost requests). */
  ip?: string
}

/** Enrichment flags for `getProfileNoPicture` (`GET /number/no_picture/:number`). */
export interface GetProfileNoPictureOptions extends RequestConfig {
  telegram?: boolean
  lookup?: boolean
  google?: boolean
}

/** Options for the breach lookups. */
export interface BreachOptions extends RequestConfig {
  /** Max records to return (1–1000, default 100). */
  limit?: number
  /** Pagination offset (0–2500). */
  offset?: number
}

/** Options for `carrierLookupAlt` (`GET /phone_data/:number`). */
export interface CarrierAltOptions extends RequestConfig {
  /** Page of spam-report results. */
  page?: number
}

/** Parameters for `search` (`GET /phone-numbers/search`). */
export interface SearchParams extends RequestConfig {
  page?: number
  limit?: number
  /** Filter by (partial) phone number. */
  number?: string
  /** General text search across multiple fields. */
  search?: string
  countryCode?: string
  sortBy?: 'date' | 'number' | 'countryCode'
  sortOrder?: SortOrder
  hasProfilePic?: boolean
  isBusiness?: boolean
  dateFrom?: string
  dateTo?: string
  includeCount?: boolean
  hasFaceAnalysis?: boolean
  faceGender?: 'male' | 'female'
  faceMinAge?: number
  faceMaxAge?: number
  facePeopleMin?: number
  facePeopleMax?: number
  /**
   * Escape hatch for server-added filters not yet modelled above. Kept as a
   * dedicated field (instead of an open index signature) so typos in the named
   * filters above are still caught by the compiler.
   */
  extra?: Record<string, string | number | boolean>
}

/** Parameters for `searchGoogleMaps` (`GET /phone-numbers/proximity/search`). */
export interface ProximitySearchParams extends RequestConfig {
  latitude: number
  longitude: number
  /** Search radius in meters (default 1000). */
  radius?: number
  page?: number
  limit?: number
}

/** Options for `bulkCheck` (live). */
export interface BulkLiveOptions extends RequestConfig {
  /** Skip ban-status checking for faster results. */
  noBanStatus?: boolean
  /** Include business profile information for each number. */
  includeBusiness?: boolean
}

/**
 * Strategy for the cache-aware {@link checkCached} lookup.
 *
 * - `cacheFirst` (default): read the cheap cache/DB endpoint first, fall back
 *   to a live check only on a miss — cheapest that still guarantees an answer.
 * - `cacheOnly`: only read the cache/DB; never spend on a live check.
 * - `live`: always perform a fresh live check.
 */
export type CheckMode = 'cacheFirst' | 'cacheOnly' | 'live'

/** Options for {@link checkCached}. */
export interface CheckCachedOptions extends RequestConfig {
  mode?: CheckMode
  /** Include a Telegram lookup (forwarded to both cache and live calls). */
  telegram?: boolean
}
