import type { LinkedInLookupResult, TelegramNumberResult } from './responses.js'

/**
 * Core WhatsApp entity types.
 *
 * These model the `WhatsAppEntry` object returned by the profile, search,
 * database and bulk endpoints. The upstream API is actively evolving and
 * enriches records on demand (Telegram, Google, carrier, face analysis, …),
 * so every enrichment field is optional and the entry carries an index
 * signature for forward compatibility with fields added server-side later.
 *
 * Dates are returned by the API as ISO-8601 strings and are typed as `string`
 * (the SDK never mutates them into `Date`, so round-tripping is lossless).
 */

/** WhatsApp JID (`<user>@<server>`), broken into parts. */
export interface WhatsAppId {
  server: string
  user: string
  _serialized: string
}

/** A single historical profile-picture record. */
export interface PictureEntry {
  number?: number | string
  date: string
  md5Image?: string
  url: string
}

/** A single historical "about"/status record. */
export interface AboutEntry {
  date: string
  about: string
  aboutSetAt?: string | null
  _id?: string
}

/** Result of AI face analysis on the profile picture. */
export interface FaceAnalysis {
  age?: { min: number; max: number }
  gender?: string
  emotion?: string
  confidence?: number
  /** Number of people detected in the picture. */
  total?: number
  people?: unknown[]
  model?: string | null
  version?: number
  [key: string]: unknown
}

/** A WhatsApp Business category. */
export interface BusinessCategory {
  id: string
  localized_display_name: string
}

/** GeoJSON-style point (`coordinates` is `[longitude, latitude]`). */
export interface GeoPoint {
  type: string
  coordinates: number[]
}

/** WhatsApp Business profile, present when `isBusiness` is true. */
export interface BusinessProfile {
  /** Either a serialized JID string or the structured id object. */
  id?: string | WhatsAppId
  dataSource?: string
  tag?: string
  description?: string
  categories?: BusinessCategory[]
  email?: string
  website?: unknown[]
  address?: string
  latitude?: number
  longitude?: number
  location?: GeoPoint
  businessHours?: unknown
  catalogStatus?: string
  coverPhoto?: { id?: string; url?: string }
  isProfileLinked?: boolean
  [key: string]: unknown
}

/** Carrier information embedded on an entry (from `includeCarrier`). */
export interface EmbeddedCarrierData {
  carrier?: string
  country?: string
  countryCode?: string
  lineType?: string
  valid?: boolean
  [key: string]: unknown
}

/**
 * A WhatsApp number record. Base identity fields are commonly present; all
 * enrichment fields are optional and only populated when explicitly requested
 * or previously collected.
 */
export interface WhatsAppEntry {
  _id?: string
  /** Phone number in international format, digits only (no `+`). */
  number: string
  /** Human-formatted phone number, e.g. `+598 98 297 150`. */
  phone?: string
  about?: string | null
  countryCode?: string

  date?: string
  creation_date?: string
  lastQueried?: string

  id?: WhatsAppId
  /** Whether the number is registered on WhatsApp. */
  exists?: boolean
  /** Error message for non-existent / failed lookups. */
  error?: string
  reason?: string
  /** Machine-readable code on not-found responses, e.g. `"NUMBER_NOT_FOUND"`. */
  code?: string
  /** Upstream HTTP status echoed in the body on a not-found (e.g. `404`). */
  status?: number
  /** Whether this record was served from cache. */
  cached?: boolean

  isBusiness?: boolean
  isEnterprise?: boolean
  isGroup?: boolean
  isUser?: boolean
  isMe?: boolean
  isMyContact?: boolean
  isWAContact?: boolean
  isVerified?: boolean
  isBlocked?: boolean

  image_status?: string
  profilePic?: string
  urlImage?: string
  hasUrlImage?: boolean
  /** Base64-encoded profile picture (when requested via `base64`). */
  base64image?: string
  md5Image?: string

  name?: string
  /**
   * WhatsApp username (the @handle). Present only where WhatsApp has rolled
   * out usernames and only when the account set one — most records have none.
   */
  username?: string
  pushname?: string
  shortName?: string
  type?: string
  labels?: unknown[]
  statusMute?: boolean
  aboutSetAt?: string | null

  deviceCount?: number
  queryCount?: number

  pictureHistory?: PictureEntry[]
  aboutHistory?: AboutEntry[]

  businessProfile?: BusinessProfile
  faceAnalysis?: FaceAnalysis
  carrier?: EmbeddedCarrierData
  carrierData?: EmbeddedCarrierData
  /** Telegram data, present when the profile lookup requested `telegram`. */
  telegram?: TelegramNumberResult
  /**
   * LinkedIn profiles matching the number, present when the profile lookup
   * requested `linkedin`. Narrow on `success`: `true` = `profiles` (at most 3)
   * and `count`; `null` = `error` (no match, or the index is unavailable).
   */
  linkedin?: LinkedInLookupResult
  /** Metadata describing how/when this record was checked. */
  checkMetadata?: Record<string, unknown>

  /** Distance in meters from the search center (proximity search only). */
  distance?: number

  __v?: number

  /** Forward-compatible catch-all for server-added fields. */
  [key: string]: unknown
}
