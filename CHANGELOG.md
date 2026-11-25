# Changelog

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
