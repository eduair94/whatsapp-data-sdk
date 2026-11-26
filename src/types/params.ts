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
  /**
   * Include the LinkedIn profiles (at most 3) whose phone matches the number,
   * under `linkedin` on the entry: `{ success: true, profiles, count }`, or
   * `{ error, success: null }` on a miss or while the index is unavailable
   * (the lookup itself never fails because of it).
   *
   * Returned by the direct API (the default `proxy` transport) and by the
   * RapidAPI "Number Validator" (the `rapidapi` transport's live host, since
   * 2026-11-26) and "WP Data DB Only" listings.
   */
  linkedin?: boolean
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
   * Filter by WhatsApp username: the whole handle or its leading part, so
   * `'frog'` matches `Frogdog_`. Case-insensitive; a leading `@` is ignored.
   * Matches only the dedicated username, never a display name. Most records
   * have no username.
   */
  username?: string
  /**
   * `true` = only numbers that have a WhatsApp username; `false` = only
   * numbers without one. Ignored by the API when `username` is given.
   */
  hasUsername?: boolean
  /**
   * Escape hatch for server-added filters not yet modelled above. Kept as a
   * dedicated field (instead of an open index signature) so typos in the named
   * filters above are still caught by the compiler.
   */
  extra?: Record<string, string | number | boolean>
}

/** Column group `q` is matched against in {@link FacebookLeakSearchParams}. */
export type FacebookLeakSearchField = 'name' | 'email' | 'location' | 'work'

/**
 * Parameters for `searchFacebookLeak` (`GET /facebook-leak/search`).
 *
 * The API refuses out-of-range values with a `400` (it does not clamp them).
 */
export interface FacebookLeakSearchParams extends RequestConfig {
  /**
   * Free text, up to 200 characters and 8 words (e.g. a first and last name).
   * Every word is matched literally; a trailing `*` matches a prefix of 3+
   * characters. A value that is only a phone number is treated as `number`.
   * Omit it to browse the records the filters allow, in phone-number order.
   */
  q?: string
  /** Match `q` against one column group only. */
  field?: FacebookLeakSearchField
  /** Exact phone lookup with country code (8–15 digits). Takes precedence over `q`. */
  number?: string
  /** ISO 3166-1 alpha-2 country of the phone number, e.g. `'US'`. */
  countryCode?: string
  gender?: 'male' | 'female'
  /** Only records that include an email address. */
  hasEmail?: boolean
  /**
   * Cross each row with the WhatsApp cache (default `true` on the API). Pass
   * `false` to skip it.
   */
  whatsapp?: boolean
  /** Page number, `>= 1`. `page * limit` may not exceed 10,000. */
  page?: number
  /** Rows per page, 1–100 (default 25). */
  limit?: number
}

/** Kind of contact data `has` can require in {@link LinkedInSearchParams}. */
export type LinkedInHasFilter = 'phones' | 'emails'

/**
 * Parameters for `searchLinkedIn` (`GET /linkedin/search`).
 *
 * The API refuses out-of-range values with a `400` (it does not clamp them).
 * All filters are combined with AND.
 */
export interface LinkedInSearchParams extends RequestConfig {
  /**
   * Free text, up to 200 characters and 8 words (a name, job title, skill…).
   * Every word is matched literally (operators and `field:value` terms have no
   * effect). A word with 7 or more digits in a row, or made only of digits and
   * phone punctuation with 7 or more digits in all, is refused with a `400`:
   * look phone numbers up with `number`. Omit it to browse by filters.
   */
  q?: string
  /**
   * Phone lookup with country code (8–15 digits, digits and a leading `+`
   * only). Returns the profiles that list the number (at most 10, no paging).
   * Takes precedence over `q` and the filters.
   */
  number?: string
  /** ISO 3166-1 alpha-2 country of the profile, e.g. `'US'`. */
  country?: string
  /** Industry, as the dataset spells it (e.g. `'Computer Software'`). */
  industry?: string
  /** Job role (e.g. `'engineering'`). */
  jobRole?: string
  /** Company size band, as the dataset spells it (e.g. `'51-200'`). */
  companySize?: string
  /** Inferred salary band, as the dataset spells it. */
  salary?: string
  /** Company name. */
  company?: string
  /**
   * Only profiles that have this kind of contact data. Sent as repeated keys
   * (`has=phones&has=emails`); several values are combined with AND.
   */
  has?: LinkedInHasFilter[]
  /**
   * Paging cursor: pass the previous page's `data.nextCursor`. Omit it for the
   * first page.
   */
  cursor?: number
  /** Profiles per page, 1–100 (default 25; at most 10 with `number`). */
  limit?: number
  /**
   * Cross each profile's phone numbers with the WhatsApp cache (default
   * `true` on the API). Pass `false` to skip it.
   */
  whatsapp?: boolean
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
