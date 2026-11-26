import { ValidationError } from './errors.js'

/**
 * Normalize a phone number to digits only (no `+`, spaces or punctuation).
 * This is the format the path-based endpoints (`/number/:n`, `/carrier/:n`, …)
 * expect. Throws if nothing usable remains.
 */
export function toDigits(input: string): string {
  const digits = String(input).replace(/[^0-9]/g, '')
  if (!digits) {
    throw new ValidationError(`Invalid phone number: ${JSON.stringify(input)}`)
  }
  return digits
}

/**
 * Normalize a phone number to E.164 (`+` followed by digits). The bulk-DB
 * endpoints validate with libphonenumber and reject values without the `+`.
 */
export function toE164(input: string): string {
  return `+${toDigits(input)}`
}

/** A single query value: a string/number, a boolean flag, or a list. */
export type QueryValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number>
  | undefined
  | null

/** Build a query string from a record, dropping `undefined`/`null` and
 * encoding booleans as the API's `"1"` flag. An array is sent as the key
 * repeated once per item (`has=a&has=b`); an empty array is dropped.
 * Returns `''` when empty. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item))
    } else if (typeof value === 'boolean') {
      if (value) search.set(key, '1')
    } else {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
