# whatsapp-data-sdk

[![npm version](https://img.shields.io/npm/v/whatsapp-data-sdk.svg)](https://www.npmjs.com/package/whatsapp-data-sdk)
[![CI](https://github.com/eduair94/whatsapp-data-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/eduair94/whatsapp-data-sdk/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/whatsapp-data-sdk.svg)](./LICENSE)
[![types: included](https://img.shields.io/npm/types/whatsapp-data-sdk.svg)](https://www.npmjs.com/package/whatsapp-data-sdk)
[![website](https://img.shields.io/badge/website-whatsapp.checkleaked.cc-2ea44f)](https://whatsapp.checkleaked.cc)

Typed TypeScript/JavaScript client for the **WhatsApp Data API** — official SDK for **[whatsapp.checkleaked.cc](https://whatsapp.checkleaked.cc)** (also on RapidAPI).

WhatsApp profile lookups, phone breaches, carrier data, Telegram checks, OSINT, geo/business search and bulk verification — plus a **cache-first lookup** that reads the cheap DB endpoint before spending on a live check.

- 🟦 Fully typed — every endpoint has request options and response interfaces (types bootstrapped from live responses with [quicktype](https://quicktype.io) and hand-curated).
- 🪶 Zero runtime dependencies — uses the native `fetch` (Node 18+, Bun, Deno, browsers).
- 📦 Dual ESM + CommonJS build with `.d.ts` types.
- 💸 Built-in cache-first strategy to minimize cost.
- 🔁 Timeouts, retries with backoff (Retry-After aware), per-request `AbortSignal` cancellation, and a clean error taxonomy.

## Install

```bash
npm install whatsapp-data-sdk
```

## Quick start

```ts
import { WhatsAppDataClient } from 'whatsapp-data-sdk'

const client = new WhatsAppDataClient({
  apiKey: process.env.WA_API_KEY!, // sent as x-rapidapi-key
})

const profile = await client.getProfile('59898297150')
console.log(profile.exists, profile.about, profile.profilePic)
```

## Authentication & hosts

Your API key is always sent in the `x-rapidapi-key` header. Choose where requests go with `transport`:

| `transport`         | Live host                       | Cache / DB-only host                     | Notes |
| ------------------- | ------------------------------- | ---------------------------------------- | ----- |
| `'proxy'` (default) | `whatsapp-proxy.checkleaked.cc` | same host, `/number_cache` path          | Simple — one base URL, no host header. |
| `'rapidapi'`        | `whatsapp-number-validator18.p.rapidapi.com`        | `wp-data-db-only.p.rapidapi.com`         | Sets `x-rapidapi-host` automatically. Use your RapidAPI key. |

```ts
// RapidAPI marketplace (live + DB-only hosts)
const client = new WhatsAppDataClient({
  apiKey: process.env.RAPIDAPI_KEY!,
  transport: 'rapidapi',
})
```

You can override any URL/host via `baseUrl`, `cacheBaseUrl`, `rapidApiHost`, `rapidApiCacheHost`.

> **RapidAPI live host = the "Whatsapp Number Validator" listing.** The former
> `wp-data.p.rapidapi.com` listing was removed from RapidAPI in November 2026.
> The validator listing is a separate subscription that returns validation
> data only: registration checks, carrier, device count, cache reads, bulk
> checks and an official-business directory search. Profile data (display
> name, about, photos) is omitted, and `getLastPicture`, `getTelegramProfile`,
> `getPhoneBreaches`, `getPhoneBreachesExternal`, `getLeakedNumbersInfo`,
> `downloadEntireDatabase`, `searchGoogleMaps`, `carrierLookupAlt`,
> `searchFacebookLeak` and `searchLinkedIn` are refused there, and it does not
> return the `linkedin` profile-lookup flag. Use the default `proxy` transport
> with a direct API key for those.

## 💸 Cache-first lookups (save money)

`checkCached()` reads the cheap cache / DB-only endpoint first and only falls back to a paid live check when the number isn't cached yet.

```ts
// cacheFirst (default): DB first → live only on a miss
const r1 = await client.checkCached('59898297150')
console.log(r1._source) // 'cache' | 'live'

// cacheOnly: never spend on a live check
const r2 = await client.checkCached('59898297150', { mode: 'cacheOnly' })

// live: always fresh
const r3 = await client.checkCached('59898297150', { mode: 'live' })
```

On the `rapidapi` transport this routes the cache read to `wp-data-db-only.p.rapidapi.com` and the live fallback to `whatsapp-number-validator18.p.rapidapi.com` — exactly the two-host money-saving flow.

## API

Every method maps 1:1 to a marketplace endpoint.

### Profile & pictures

```ts
await client.getProfile(number, options?)            // Get Profile Information
await client.getProfileNoPicture(number, options?)   // Get Profile Information (No profile pic)
await client.getLastPicture(number)                  // Get Last Saved Picture (JPEG bytes)
await client.getDeviceCount(number)                  // Device count
await client.getOsintInfo(number)                    // OSINT Info
```

`getProfile` options include `telegram`, `google`, `lookup`, `linkedin` (LinkedIn profiles for the number — [see below](#linkedin-on-a-profile-lookup)), `includeCarrier`, `base64`, `geminiFaceAnalysis`, `reverseImageSearch`, `fullAiReport`, `includeDeviceCount`, `onlyCheck`, `useCache`, `forceBypassCache`, and more.

```ts
const pic = await client.getLastPicture('59898297150')
// pic.bytes: Uint8Array, pic.contentType: string
htmlImg.src = pic.toDataUri()
```

### Phone breaches

```ts
await client.getPhoneBreaches(number, { limit, offset }) // Get Phone Breaches (no external key)
await client.getPhoneBreachesExternal(number, apiKey)     // Get Phone Breaches (your checkleaked.cc key)
```

### Search & database

```ts
await client.search({ countryCode: 'UY', isBusiness: true, limit: 20 })   // Search
await client.searchGoogleMaps({ latitude: -34.9, longitude: -56.16, radius: 2000 }) // Search in Google Maps

// Bulk downloads return a Google Drive link to the full dataset (MEGA tier only)
const leaks = await client.getLeakedNumbersInfo()   // Leaked Numbers (500M database)
console.log(leaks.driveFolder.url)

const backup = await client.downloadEntireDatabase() // Download the Entire DB
console.log(backup.driveFolder.url)
```

> **Note:** `getLeakedNumbersInfo()` and `downloadEntireDatabase()` are restricted to **MEGA-tier keys** (500k+ request plans). Lower tiers get a `403` / `AuthError`.

#### WhatsApp username

Profiles and search rows carry `username` (the WhatsApp @handle) where
WhatsApp has rolled out usernames and the account set one — most records have
none. `search` can filter on it:

```ts
// Handle or its leading part; case-insensitive, a leading '@' is ignored.
// Matches only the username, never a display name.
const byHandle = await client.search({ username: 'frog' })
console.log(byHandle.data.docs.map((d) => d.username)) // e.g. ['Frogdog_']

// Only numbers that have a username (false = only numbers without one)
await client.search({ countryCode: 'US', hasUsername: true })
```

### Facebook leak search

`searchFacebookLeak` searches the 2019 Facebook leak by name, email, location,
workplace or phone number. Each row is crossed with the WhatsApp cache by
number (`row.whatsapp`: profile, username, business details, or
`status: 'notOnWhatsapp'`) — a cache read only, never a live lookup.

```ts
const res = await client.searchFacebookLeak({
  q: 'jane doe',       // ≤ 8 words, literal match; trailing * = prefix (3+ chars)
  field: 'name',       // 'name' | 'email' | 'location' | 'work'
  countryCode: 'US',
  limit: 25,           // 1–100; page * limit ≤ 10,000
})
for (const row of res.data.docs) {
  console.log(row.e164, row.firstName, row.lastName, row.whatsapp?.status, row.whatsapp?.username)
}
console.log(res.data.totalDocs, res.data.capped)

// Exact number lookup (takes precedence over q); skip the WhatsApp cross-reference
await client.searchFacebookLeak({ number: '15551234567', whatsapp: false })
```

Other filters: `gender` (`'male' | 'female'`), `hasEmail`, `page`. One credit
per successful page.

- **Direct API keys only** (default `proxy` transport). Not available on
  RapidAPI: with `transport: 'rapidapi'` it answers `403`
  (`ENDPOINT_UNAVAILABLE`) → `AuthError`.
- Out-of-range values are refused with `400` (`INVALID_PARAMETER`,
  `INVALID_NUMBER`, `INVALID_QUERY`), not clamped → `HttpError`.
- `429` `RATE_LIMITED` (30/min and 2,000/day per key) → `RateLimitError` with
  `retryAfterMs`.
- `502` `UPSTREAM_ERROR`, `503` `BUSY`, `504` `TOO_BROAD` (add words, a
  `field` or `countryCode`) → `HttpError`, retried like any 5xx GET; pass
  `retries: 0` to fail fast.

The API's error code is in `err.body.code`.

### LinkedIn search

`searchLinkedIn` searches the LinkedIn profile dataset by words, filters or
phone number. Each profile carries `details` (emails, phones and other source
columns) and, when it has a valid phone number, a `whatsapp` cross-reference:
per number, the WhatsApp cache's record (profile, username, business details),
`status: 'notOnWhatsapp'` (checked, no account) or `status: 'absent'` (never
checked) — a cache read only, never a live lookup.

```ts
const res = await client.searchLinkedIn({
  q: 'data engineer',          // ≤ 8 words, matched literally
  country: 'UY',               // ISO 3166-1 alpha-2
  has: ['phones', 'emails'],   // only profiles with phones AND emails
  limit: 25,                   // 1–100
})
for (const p of res.data.docs) {
  console.log(p.fullName, p.jobTitle, p.company, p.whatsapp?.onWhatsapp)
}

// Cursor paging: send the previous nextCursor (null on the last page)
let cursor: number | null = res.data.nextCursor
while (cursor !== null) {
  const next = await client.searchLinkedIn({ q: 'data engineer', country: 'UY', cursor })
  cursor = next.data.nextCursor
}

// Look one phone number up (country code included; takes precedence over q and
// the filters; at most 10 profiles, no paging). Skip the WhatsApp cross-reference:
await client.searchLinkedIn({ number: '+59899123456', whatsapp: false })
```

Other filters: `industry`, `jobRole`, `companySize`, `salary`, `company`.
`res.data.totalDocs` is the match count, a lower bound when `capped` is `true`
(and `null` when the service gave none); `indexComplete: false` means the
dataset is still being indexed and the newest profiles may be missing.

- **Direct API keys only** (default `proxy` transport). Not available on
  RapidAPI: with `transport: 'rapidapi'` it answers `403`
  (`ENDPOINT_UNAVAILABLE`) → `AuthError`.
- A `q` word with 7+ digits (or made only of digits and phone punctuation) is
  refused with `400` — look phone numbers up with `number`. Out-of-range
  values are refused too (`INVALID_PARAMETER`, `INVALID_NUMBER`,
  `INVALID_QUERY`), not clamped → `HttpError`.
- `429` `RATE_LIMITED` (30/min and 2,000/day per key) → `RateLimitError` with
  `retryAfterMs`.
- `502` `UPSTREAM_ERROR`, `503` `BUSY`/`UNAVAILABLE`, `504` `TOO_BROAD` (add
  words or filters) → `HttpError`, retried like any 5xx GET; pass
  `retries: 0` to fail fast.

The API's error code is in `err.body.code`.

#### LinkedIn on a profile lookup

`getProfile` takes `linkedin: true` to add the LinkedIn profiles (at most 3)
whose phone matches the number, under `linkedin` on the entry:

```ts
const entry = await client.getProfile('59898297150', { linkedin: true })
const li = entry.linkedin
if (li?.success) {
  console.log(li.count, li.profiles.map((p) => p.fullName))
} else if (li) {
  console.log(li.error) // e.g. 'No LinkedIn profile for this number' (success: null)
}
```

A miss, or an index that is unavailable, answers `{ error, success: null }`;
the lookup itself never fails because of it. Available on the direct API (the
default `proxy` transport) and the RapidAPI "WP Data" / "WP Data DB Only"
listings; the "Number Validator" listing, which the `rapidapi` transport's live
host points at, does not return it.

### Bulk checks

```ts
await client.bulkCheck(numbers, { includeBusiness, noBanStatus }) // Bulk Check (live, max 50)
await client.bulkCheckDbBasic(numbers)                            // Basic Check (DB, max 1000)
await client.bulkCheckDbFull(numbers)                            // Full Check (DB, max 1000)
```

### Telegram (experimental)

```ts
await client.getTelegramProfile('59898297150')            // Get Profile Information Telegram
await client.getTelegramProfile(['num1', 'num2'])         // batch
```

### Carrier

```ts
await client.carrierLookup(number)              // Carrier Lookup
await client.carrierLookupAlt(number)           // Carrier Lookup Alternative (spam-report signals)
await client.carrierLookupAlt(number, { page: 2 }) // page through the reports (response has a `pagination` block)
```

## "Not found" resolves — it does not throw

A number simply **not on WhatsApp** is a normal result, not an error, so these
resolve (they never reject):

- `getProfile` / `getProfileNoPicture` / `checkCached` → an entry with `exists:false` (and `code:'NUMBER_NOT_FOUND'`).
- `search` with zero matches → an empty page (`success:false`, `data.docs:[]`).
- `getDeviceCount` for a non-WhatsApp number → `success:false` (with `deviceCount` absent).

```ts
const p = await client.getProfile('14155552671')
if (!p.exists) console.log('not on WhatsApp')
```

What **does** throw: an invalid number (`400`), auth failure (`401/403`),
rate limit (`429`), timeout, network failure, and `5xx`.

## Per-request options

Every method takes a trailing options object that also accepts `signal`,
`timeoutMs`, and `retries` — for per-call cancellation and tuning:

```ts
const controller = new AbortController()
const p = client.getProfile('59898297150', {
  telegram: true,
  signal: controller.signal, // cancel this specific request
  timeoutMs: 5000,           // override the client timeout for this call
})
controller.abort() // rejects with WhatsAppDataError
```

## Errors

All rejections are a subclass of `WhatsAppDataError`, so a single `catch`
handles everything. The full taxonomy:

| Class | When |
| --- | --- |
| `ValidationError` | Bad arguments (thrown **synchronously**, before any request; no `.status`). |
| `AuthError` | `401` / `403` — missing, invalid, or unsubscribed key. |
| `RateLimitError` | `429` — carries `retryAfterMs` when the server sent `Retry-After`. |
| `HttpError` | Any other non-2xx (e.g. `400`, `5xx`); carries `.status` and `.body`. |
| `TimeoutError` | The request exceeded `timeoutMs`. |
| `NetworkError` | Transport failure (DNS, connection reset, mid-body abort). |
| `WhatsAppDataError` | Base class for all of the above. |

```ts
import { AuthError, RateLimitError, TimeoutError, WhatsAppDataError } from 'whatsapp-data-sdk'

try {
  await client.getProfile('59898297150')
} catch (err) {
  if (err instanceof AuthError) {/* 401/403 — bad/unsubscribed key */}
  else if (err instanceof RateLimitError) {/* 429 — err.retryAfterMs */}
  else if (err instanceof TimeoutError) {/* request timed out */}
  else if (err instanceof WhatsAppDataError) {
    console.error(err.status, err.body)
  }
}
```

## Configuration

```ts
new WhatsAppDataClient({
  apiKey: '...',           // required
  transport: 'proxy',      // 'proxy' | 'rapidapi'
  timeoutMs: 60000,        // request timeout (bounds headers AND body read)
  retries: 2,              // retry 5xx / 429 / network / timeout (GET only) with backoff
  retryDelayMs: 500,       // exponential base; 429 honors Retry-After when longer
  baseUrl: '...',          // override live base URL
  cacheBaseUrl: '...',     // override cache/DB-only base URL
  rapidApiHost: '...',     // override live x-rapidapi-host
  rapidApiCacheHost: '...',// override cache x-rapidapi-host
  userAgent: '...',        // custom User-Agent
  fetch: globalThis.fetch, // inject a custom fetch (tests / polyfills)
})
```

> POSTs (`bulkCheck`, `bulkCheckDb*`) are **not** auto-retried, to avoid
> double-spending quota on a request the server may have already processed.

## Phone number formats

Pass numbers in any format — the SDK normalizes them, and exports the helpers
so you can reuse the same normalization:

```ts
import { toDigits, toE164 } from 'whatsapp-data-sdk'
toDigits('+598 98 297 150') // '59898297150'  (path & live endpoints)
toE164('59898297150')       // '+59898297150' (bulk-DB endpoints; their validator requires it)
// both throw ValidationError on input with no digits
```

## Notes

- This SDK covers exactly the marketplace endpoints (profile, breaches, pictures, device count, search, Google-Maps/proximity search, bulk checks, Telegram, database, carrier, OSINT), plus the direct-key-only Facebook leak search and LinkedIn search.
- Enrichments run entirely server-side — you never supply Gemini, LeakCheck, or any other keys. Face analysis, breach lookups, etc. are handled by the API. The only user-provided key is your own checkleaked.cc key for `getPhoneBreachesExternal`.

## License

MIT © Eduardo Airaudo
