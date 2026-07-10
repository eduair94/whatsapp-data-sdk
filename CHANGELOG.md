# Changelog

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
