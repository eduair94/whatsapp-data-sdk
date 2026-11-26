/**
 * Per-endpoint response types.
 *
 * Bootstrapped from live API samples with quicktype, then curated: dates typed
 * as ISO strings, dynamic maps modelled with `Record<>`, shared sub-shapes
 * deduplicated, and forward-compatible index signatures added where the API
 * returns open-ended metadata.
 */
import type { PageInfo } from './pagination.js'
import type { WhatsAppEntry } from './whatsapp.js'

/** Common request metadata block many endpoints attach. */
export interface RequestMetadata {
  requestId?: string
  timestamp?: number
  processingTime?: number
  source?: string
  url?: string
  proxy?: string
  [key: string]: unknown
}

/* ── Device count ─────────────────────────────────────────────────────── */

export interface DeviceCountHistoryEntry {
  date: string
  deviceCount: number
  _id?: string
}

export interface DeviceCountResponse {
  success: boolean
  number: string
  /** Absent when the number isn't on WhatsApp (then `success:false` + `error`). */
  deviceCount?: number
  lastUpdated?: string
  fromCache?: boolean
  history?: DeviceCountHistoryEntry[]
  /** Present on a failed lookup (e.g. number not found). */
  error?: string
  status?: number
  [key: string]: unknown
}

/* ── OSINT info ───────────────────────────────────────────────────────── */

export interface OsintInfoResponse {
  success: boolean
  phone_number: string
  hasWhatsapp: boolean
  isBanned: boolean
  error: boolean | string
  metadata?: RequestMetadata
  [key: string]: unknown
}

/* ── Carrier lookup ───────────────────────────────────────────────────── */

export interface CarrierFormatted {
  local?: string
  national?: string
  international?: string
  e164?: string
  rfc3966?: string
}

export interface CarrierLookupResponse {
  success: boolean
  phone: string
  country?: string
  countryCode?: string
  carrier?: string
  /** City/region, e.g. `"San Francisco, CA"` (present for some numbers). */
  location?: string
  lineType?: string
  valid?: boolean
  formatted?: CarrierFormatted
  metadata?: RequestMetadata
  [key: string]: unknown
}

/** Alternative carrier source (`/phone_data`) — adds spam-report signals. */
export interface CarrierAltResponse {
  success: boolean
  phone: string
  country?: string
  countryCode?: string
  operator?: string
  lineType?: string
  evaluation?: string
  reports?: number
  consultedTimes?: number
  lastConsulted?: string
  valid?: boolean
  formatted?: CarrierFormatted
  pagination?: {
    currentPage: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  metadata?: RequestMetadata
  [key: string]: unknown
}

/* ── Phone breaches (LeakCheck Pro, no external key) ──────────────────── */

export interface BreachSource {
  name: string
  /** Breach date (e.g. `"2024-10"`), or `null` when unknown. */
  breach_date?: string | null
  unverified?: number
  passwordless?: number
  compilation?: number
  [key: string]: unknown
}

export interface BreachRecord {
  source: BreachSource
  fields?: string[]
  email?: string
  username?: string
  password?: string
  name?: string
  first_name?: string
  last_name?: string
  address?: string
  phone?: string
  country?: string
  telegram_id?: string
  [key: string]: unknown
}

export interface PhoneBreachesResponse {
  success: boolean
  /** Number of breach records found. Absent on a `success:false` envelope. */
  found?: number
  /** Remaining LeakCheck Pro quota, when reported. */
  quota?: number
  /** Breach records. Absent (not `[]`) on a `success:false` envelope. */
  result?: BreachRecord[]
  /** Error message on a failed lookup (bad input, exhausted quota). */
  error?: string
  [key: string]: unknown
}

/* ── Phone breaches (external checkleaked.cc key) ─────────────────────── */

/**
 * Response from `/check_leaks` (legacy checkleaked.cc service). Returns either
 * a populated result set or an error envelope (e.g. on a bad/expired key).
 */
export interface ExternalBreachesResponse {
  entries?: unknown[]
  results?: number
  pages?: number
  page?: number
  urlSearch?: string
  error?: string
  isError?: boolean
  isTimeout?: boolean
  [key: string]: unknown
}

/* ── Telegram profile ─────────────────────────────────────────────────── */

/**
 * Per-number Telegram result. Field names mirror the API's snake_case exactly.
 * When the number is NOT on Telegram (or the lookup failed), only `error`,
 * `countryCode` and `phone` are present.
 */
export interface TelegramNumberResult {
  /** Present when the number is NOT on Telegram / lookup failed. */
  error?: string
  countryCode?: string
  phone?: string
  /* ── present when the number IS on Telegram ── */
  id?: number | string
  username?: string
  usernames?: string[] | null
  first_name?: string
  last_name?: string
  fake?: boolean
  verified?: boolean
  premium?: boolean
  mutual_contact?: boolean
  bot?: boolean
  bot_chat_history?: boolean
  restricted?: boolean
  restriction_reason?: string | null
  user_was_online?: string
  hasPhoto?: boolean
  photoUrl?: string
  type?: string | null
  _id?: string
  number?: string
  date?: string
  __v?: number
  [key: string]: unknown
}

export interface TelegramValidPhone {
  phoneNumber: string
  cleanPhone: string
  isValid: boolean
  formatted: string
  country: string
  nationalNumber: string
}

export interface TelegramCheckResponse {
  success: boolean
  /** Keyed by the formatted phone (e.g. `"+59898297150"`). */
  data: Record<string, TelegramNumberResult>
  phoneValidation?: {
    validPhones: TelegramValidPhone[]
    invalidPhones: unknown[]
    totalCount: number
    validCount: number
    invalidCount: number
  }
  trackingStats?: Record<string, unknown>
  [key: string]: unknown
}

/* ── Bulk check (live) ────────────────────────────────────────────────── */

/** One element of the live `/bulk_check` array response. */
export interface BulkLiveResult {
  success: boolean
  number: string
  hasWhatsapp: boolean
  error?: string
  db?: boolean
  /** Present when `includeBusiness` was requested and the number is a business. */
  businessProfile?: WhatsAppEntry['businessProfile']
  [key: string]: unknown
}

export type BulkLiveResponse = BulkLiveResult[]

/* ── Bulk check against the DB (basic / full) ─────────────────────────── */

export interface BulkDbResult {
  number: string
  isValid: boolean
  exists: boolean
  lastCheck?: string
  dbError?: string
  error?: string
  /** Full DB record when the number is found (present on the "full" endpoint). */
  data?: WhatsAppEntry
}

export interface BulkDbSummary {
  total: number
  valid: number
  invalid: number
  found: number
  notFound: number
  withErrors: number
  withoutErrors: number
}

export interface BulkDbResponse {
  success: boolean
  data: {
    results: BulkDbResult[]
    summary: BulkDbSummary
  }
}

/* ── Proximity / Google-Maps search ───────────────────────────────────── */

export interface ProximitySearchData extends PageInfo<WhatsAppEntry> {
  resultCount?: number
  sortBy?: string
  searchCenter?: {
    latitude: number
    longitude: number
    radiusInMeters: number
  }
  distanceRange?: { closest: number; farthest: number }
}

export interface ProximitySearchResponse {
  success: boolean
  data: ProximitySearchData
}

/* ── Facebook leak search ──────────────────────────────────────────────── */

/** Business details from the WhatsApp record of a Facebook leak row. */
export interface FacebookLeakBusiness {
  name?: string
  description?: string
  email?: string
  /** Websites joined with `"; "`. */
  website?: string
  address?: string
  /** Category names joined with `", "`. */
  categories?: string
}

/** What the WhatsApp cache holds for a Facebook leak row's number. */
export interface FacebookLeakWhatsAppSummary {
  /** `'found'` = a WhatsApp account; `'notOnWhatsapp'` = checked, no account. */
  status: 'found' | 'notOnWhatsapp'
  name?: string
  /**
   * WhatsApp username (@handle). Present only where WhatsApp offers usernames
   * and the account set one.
   */
  username?: string
  about?: string
  countryCode?: string
  isBusiness?: boolean
  isEnterprise?: boolean
  /** Archived profile photo URL. */
  photoUrl?: string
  /** When the number was last checked on WhatsApp (ISO 8601). */
  checkedAt?: string
  business?: FacebookLeakBusiness
}

/** One row of `searchFacebookLeak`. */
export interface FacebookLeakSearchItem {
  /** Phone number, digits only (no `+`). */
  number: string
  /** Phone number in E.164 (`+` and digits). */
  e164: string
  regionCode?: string
  fbId?: string
  firstName?: string
  lastName?: string
  gender?: string
  /** Remaining leak fields (location, region, relationshipStatus, company, email, birthdate, …). */
  other?: Record<string, string>
  /** `https://facebook.com/profile.php?id=…`, when the row has an `fbId`. */
  facebookProfile?: string
  /**
   * The WhatsApp cache's record for the number. Absent when the number was
   * never checked on WhatsApp, or the cross-reference was skipped
   * (`whatsapp:false`) or unavailable (see `whatsappAvailable`).
   */
  whatsapp?: FacebookLeakWhatsAppSummary
}

/** The page carried by {@link FacebookLeakSearchResponse}. */
export interface FacebookLeakSearchData {
  docs: FacebookLeakSearchItem[]
  /** Total matches, at most 10,000. */
  totalDocs: number
  /** `true` when there are more matches than `totalDocs`. */
  capped: boolean
  page: number
  limit: number
  /** `false` when the WhatsApp cross-reference was skipped or could not be read. */
  whatsappAvailable: boolean
}

/** Response of `searchFacebookLeak` (`GET /facebook-leak/search`). */
export interface FacebookLeakSearchResponse {
  success: boolean
  data: FacebookLeakSearchData
}

/* ── LinkedIn ──────────────────────────────────────────────────────────── */

/**
 * A LinkedIn profile, as returned by the `linkedin` profile-lookup flag and by
 * `searchLinkedIn`. Any field can be `null` when the source has no value.
 */
export interface LinkedInProfile {
  linkedinUrl: string | null
  fullName: string | null
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  company: string | null
  industry: string | null
  country: string | null
  location: string | null
  skills: string | null
  summary: string | null
  /**
   * Further source columns as the index stores them (snake_case), e.g.
   * `emails`, `phones`, `mobile`, `gender`, `job_start_date`,
   * `company_website`, `facebook_url`, `twitter_url`, `github_url`,
   * `locality`, `region`.
   */
  details: Record<string, unknown> | null
}

/** The `linkedin` result on an entry when profiles matched the number. */
export interface LinkedInLookupHit {
  success: true
  /** At most 3 profiles. */
  profiles: LinkedInProfile[]
  count: number
}

/**
 * The `linkedin` result when nothing matched, or the index was unavailable
 * (e.g. `"No LinkedIn profile for this number"`). The lookup itself still
 * succeeds.
 */
export interface LinkedInLookupMiss {
  error: string
  success: null
}

/**
 * `WhatsAppEntry.linkedin` — present when `getProfile` was called with
 * `linkedin:true`. Narrow on `success` (`true` = hit, `null` = miss).
 */
export type LinkedInLookupResult = LinkedInLookupHit | LinkedInLookupMiss

/**
 * What the WhatsApp cache holds for a number of a LinkedIn profile. Same shape
 * as {@link FacebookLeakWhatsAppSummary}.
 */
export type LinkedInWhatsAppSummary = FacebookLeakWhatsAppSummary

/** One phone number of a LinkedIn profile, crossed with the WhatsApp cache. */
export interface LinkedInWhatsAppNumber {
  /** The profile's number, in E.164 (`+` and digits). */
  number: string
  /**
   * `'found'` = a WhatsApp account; `'notOnWhatsapp'` = checked, no account;
   * `'absent'` = the number was never checked on WhatsApp.
   */
  status: 'found' | 'notOnWhatsapp' | 'absent'
  /** The WhatsApp record; absent when `status` is `'absent'`. */
  summary?: LinkedInWhatsAppSummary
}

/** The WhatsApp cross-reference of a {@link LinkedInSearchItem}. */
export interface LinkedInWhatsAppInfo {
  /** At least one of the numbers has a record in the WhatsApp dataset. */
  checked: boolean
  /** At least one of the numbers has a WhatsApp account. */
  onWhatsapp: boolean
  numbers: LinkedInWhatsAppNumber[]
}

/** One row of `searchLinkedIn`. */
export interface LinkedInSearchItem extends LinkedInProfile {
  /** The profile's id in the dataset (the paging cursor is the last id of a page). */
  id: number
  /**
   * Absent when the profile has no valid phone number, or the cross-reference
   * was skipped (`whatsapp:false`) or unavailable (see `whatsappAvailable`).
   */
  whatsapp?: LinkedInWhatsAppInfo
}

/** The page carried by {@link LinkedInSearchResponse}. */
export interface LinkedInSearchData {
  docs: LinkedInSearchItem[]
  /**
   * Number of matches; a lower bound when `capped` is `true`. `null` when the
   * service gave none.
   */
  totalDocs: number | null
  /** `true` when counting stopped early, so `totalDocs` is a lower bound. */
  capped: boolean
  /** Send as `cursor` for the next page; `null` on the last page. */
  nextCursor: number | null
  /** Profiles asked for per page (at most 10 for a `number` lookup). */
  limit: number
  /** `false` when the WhatsApp cross-reference was skipped or could not be read. */
  whatsappAvailable: boolean
  /** `false` while the dataset is still being indexed: the newest profiles may be missing. */
  indexComplete: boolean
}

/** Response of `searchLinkedIn` (`GET /linkedin/search`). */
export interface LinkedInSearchResponse {
  success: boolean
  data: LinkedInSearchData
}

/* ── Database / leak downloads (Drive links) ──────────────────────────── */

/**
 * Response for the bulk-download endpoints (`/leaks/info`, `/backup/info`).
 * Returns a Google Drive folder link to the full dataset rather than the data
 * inline. **Restricted to MEGA-tier keys** by the API — lower tiers get 403.
 */
export interface DriveFolderInfoResponse {
  success: boolean
  name: string
  description: string
  driveFolder: {
    /** Google Drive shared-folder URL for the dataset. */
    url: string
    name: string
    type: string
  }
  access: {
    type: string
    permissions: string
  }
  timestamp: string
  [key: string]: unknown
}

/* ── Last saved picture (binary) ──────────────────────────────────────── */

/** Result of `getLastPicture` — raw JPEG bytes plus metadata. */
export interface PictureResult {
  /** Raw image bytes. */
  bytes: Uint8Array
  contentType: string
  /** Convenience `data:` URI ready for an `<img src>`. */
  toDataUri(): string
}
