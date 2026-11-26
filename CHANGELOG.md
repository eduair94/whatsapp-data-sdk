# Changelog

## 1.5.0

- `searchLinkedIn(params)` — `GET /linkedin/search`: search the LinkedIn profile dataset by words (`q`), filters (`country`, `industry`, `jobRole`, `companySize`, `salary`, `company`, `has`) or phone number (`number`), with cursor paging (`cursor` / `data.nextCursor`), `limit` and `whatsapp`. Each profile is crossed with the WhatsApp cache by number (`whatsapp`, cache-only — never a live lookup) unless `whatsapp:false`. Direct API keys only; on RapidAPI the API answers `403` (`AuthError`). New types `LinkedInSearchParams`, `LinkedInSearchResponse`, `LinkedInSearchItem`, `LinkedInProfile`, `LinkedInWhatsAppNumber` and friends.
- `getProfile` takes `linkedin:true` (sent as `linkedin=1`) to add the LinkedIn profiles (at most 3) whose phone matches the number: `WhatsAppEntry.linkedin` is `{ success: true, profiles, count }` or `{ error, success: null }` (`LinkedInLookupResult`). Returned by the direct API and the RapidAPI WP Data / DB Only listings, not by the Number Validator listing.
- Query encoding: an array query value is now sent as the key repeated per item (`has=phones&has=emails`); an empty array is omitted.
- Retries: a `504` whose body `code` is `TOO_BROAD` is no longer retried (the same search would time out again; add words or filters). A `429` or `503` with `Retry-After` now waits that long before the retry instead of the exponential backoff, at most 30 s, within the configured `retries`. `HttpError.retryAfterMs` carries a `503`'s `Retry-After` (`RateLimitError.retryAfterMs` is unchanged).

## 1.4.0

- `searchFacebookLeak(params)` — `GET /facebook-leak/search`: search the 2019 Facebook leak by name, email, location, workplace or phone number (`q`, `field`, `number`, `countryCode`, `gender`, `hasEmail`, `whatsapp`, `page`, `limit`), each row crossed with the WhatsApp cache. Direct API keys only; on RapidAPI the API answers `403` (`AuthError`). New types `FacebookLeakSearchParams`, `FacebookLeakSearchResponse`, `FacebookLeakSearchItem`, `FacebookLeakWhatsAppSummary` and friends.
- WhatsApp username: `WhatsAppEntry.username` (the @handle, present only where WhatsApp offers usernames and the account set one); `search` takes `username` (handle or leading part, case-insensitive, leading `@` ignored) and `hasUsername` (sent explicitly as `true`/`false`).
- `rapidapi` transport: the live host is now `whatsapp-number-validator18.p.rapidapi.com`. RapidAPI removed the `wp-data.p.rapidapi.com` listing in November 2026, so the old default no longer answers. The validator listing is a separate subscription that returns validation data only; the README lists the methods it refuses. The cache host (`wp-data-db-only.p.rapidapi.com`) and the default `proxy` transport are unchanged.

## 1.3.1

- Docs: clarify that enrichments (face analysis, breach lookups, etc.) run entirely server-side — the SDK consumer never supplies Gemini/LeakCheck keys. The only user-provided key is your own checkleaked.cc key for `getPhoneBreachesExternal`.

## 1.3.0

- Per-request `signal` (AbortSignal), `timeoutMs`, and `retries` on every method.
- Timeout now bounds the response body read (not just headers); body-read failures map to `NetworkError`/`TimeoutError`.
- `429` honors the `Retry-After` header (`RateLimitError.retryAfterMs`).
- POST requests (`bulkCheck`, `bulkCheckDb*`) are no longer auto-retried (avoids double-spend).
- `checkCached` treats an authoritative cached "not on WhatsApp" record as a hit (only a true `NOT_IN_DATABASE` miss falls through to a live check).
- `search` sends `false` boolean filters explicitly (e.g. `isBusiness:false`).
- Fixed browser "Illegal invocation" by binding the global `fetch`.
- Types: `PhoneBreachesResponse.found/result` optional; `WhatsAppEntry.telegram` typed as `TelegramNumberResult`; exported `CarrierAltOptions`; `SearchParams.extra` instead of an open index signature.
- Packaging: per-condition types in the `exports` map (correct types for CommonJS consumers); `prepare` script.

## 1.2.0

- Corrected status-code handling from live data: not-found numbers resolve with `exists:false` (no throw); empty `search` returns an empty page; `deviceCount` optional.
- Telegram fields use the API's snake_case; `breach_date` nullable; carrier `location` added.

## 1.1.0

- `getLeakedNumbersInfo` (`/leaks/info`) and `downloadEntireDatabase` (`/backup/info`) return the dataset's Google Drive link (MEGA tier only).

## 1.0.0

- Initial release: 17 WhatsApp Data API endpoints, cache-first `checkCached`, dual ESM/CJS build, typed responses.
