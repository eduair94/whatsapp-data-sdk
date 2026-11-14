import { describe, expect, it } from 'vitest'
import {
  AuthError,
  HttpError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  WhatsAppDataClient,
  WhatsAppDataError,
  type FetchLike,
} from '../src/index.js'
import { mockFetch, type MockResponse } from './mock.js'

/** An AbortError with the right `.name` (what fetch throws on abort). */
const abortError = (): Error => {
  const e = new Error('The operation was aborted')
  e.name = 'AbortError'
  return e
}

/** A fetch that never resolves until its signal aborts, then rejects. */
const hangingFetch: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal
    if (signal?.aborted) return reject(abortError())
    signal?.addEventListener('abort', () => reject(abortError()))
  })

const make = (responses: MockResponse[], opts = {}) => {
  const { fetch, calls } = mockFetch(responses)
  const client = new WhatsAppDataClient({ apiKey: 'test-key', fetch, ...opts })
  return { client, calls }
}

describe('getProfile', () => {
  it('hits /number/:digits, strips non-digits, sends the api key', async () => {
    const { client, calls } = make([{ json: { number: '59898297150', exists: true } }])
    const res = await client.getProfile('+598 98 297 150')
    expect(res.exists).toBe(true)
    expect(calls[0]!.url).toBe(
      'https://whatsapp-proxy.checkleaked.cc/number/59898297150'
    )
    expect(calls[0]!.headers['x-rapidapi-key']).toBe('test-key')
  })

  it('encodes boolean enrichment flags as "1"', async () => {
    const { client, calls } = make([{ json: {} }])
    await client.getProfile('59898297150', {
      telegram: true,
      google: true,
      base64: false,
    })
    expect(calls[0]!.url).toContain('telegram=1')
    expect(calls[0]!.url).toContain('google=1')
    expect(calls[0]!.url).not.toContain('base64')
  })
})

describe('getProfileNoPicture', () => {
  it('hits the no_picture path', async () => {
    const { client, calls } = make([{ json: {} }])
    await client.getProfileNoPicture('59898297150')
    expect(calls[0]!.url).toContain('/number/no_picture/59898297150')
  })
})

describe('getLastPicture', () => {
  it('returns raw bytes and a data URI', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const { client } = make([{ bytes, contentType: 'image/jpeg' }])
    const pic = await client.getLastPicture('59898297150')
    expect(pic.bytes).toEqual(bytes)
    expect(pic.contentType).toBe('image/jpeg')
    expect(pic.toDataUri()).toBe('data:image/jpeg;base64,AQIDBA==')
  })
})

describe('carrier lookups', () => {
  it('carrierLookup hits /carrier/:digits', async () => {
    const { client, calls } = make([{ json: { success: true, phone: '+598' } }])
    await client.carrierLookup('59898297150')
    expect(calls[0]!.url).toContain('/carrier/59898297150')
  })

  it('carrierLookupAlt hits /phone_data/:digits', async () => {
    const { client, calls } = make([{ json: { success: true, phone: '+598' } }])
    await client.carrierLookupAlt('59898297150', { page: 2 })
    expect(calls[0]!.url).toContain('/phone_data/59898297150')
    expect(calls[0]!.url).toContain('page=2')
  })
})

describe('bulk checks', () => {
  it('bulkCheck sends digits and enforces the 50-number cap', async () => {
    const { client, calls } = make([{ json: [] }])
    await client.bulkCheck(['+1 415 555 2671', '59898297150'])
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.body).toEqual({
      numbers: ['14155552671', '59898297150'],
      includeBusiness: undefined,
    })

    const { client: c2 } = make([{ json: [] }])
    const tooMany = Array.from({ length: 51 }, (_, i) => String(i))
    await expect(c2.bulkCheck(tooMany)).rejects.toBeInstanceOf(ValidationError)
  })

  it('bulkCheckDbFull normalizes numbers to +E164 and sends fullInfo', async () => {
    const { client, calls } = make([
      { json: { success: true, data: { results: [], summary: {} } } },
    ])
    await client.bulkCheckDbFull(['972526658013'])
    expect(calls[0]!.url).toContain('/phone-numbers/bulk-check/full')
    expect(calls[0]!.body).toEqual({ numbers: ['+972526658013'], fullInfo: true })
  })
})

describe('getTelegramProfile', () => {
  it('joins multiple phones into a comma-separated query', async () => {
    const { client, calls } = make([{ json: { success: true, data: {} } }])
    await client.getTelegramProfile(['59898297150', '+1 415 555 2671'])
    expect(calls[0]!.url).toContain('/telegram/check')
    expect(decodeURIComponent(calls[0]!.url)).toContain(
      'phones=59898297150,14155552671'
    )
  })
})

describe('searchGoogleMaps', () => {
  it('requires numeric lat/long', async () => {
    const { client } = make([{ json: {} }])
    // @ts-expect-error missing coords
    await expect(client.searchGoogleMaps({})).rejects.toBeInstanceOf(
      ValidationError
    )
  })

  it('passes coordinates through', async () => {
    const { client, calls } = make([{ json: { success: true, data: { docs: [] } } }])
    await client.searchGoogleMaps({ latitude: -34.9, longitude: -56.16, radius: 2000 })
    expect(calls[0]!.url).toContain('/phone-numbers/proximity/search')
    expect(calls[0]!.url).toContain('latitude=-34.9')
    expect(calls[0]!.url).toContain('radius=2000')
  })
})

describe('bulk downloads (Drive links)', () => {
  it('getLeakedNumbersInfo hits /leaks/info', async () => {
    const { client, calls } = make([
      {
        json: {
          success: true,
          name: 'Leaks Storage',
          driveFolder: { url: 'https://drive.google.com/drive/folders/abc', name: 'x', type: 'y' },
        },
      },
    ])
    const res = await client.getLeakedNumbersInfo()
    expect(calls[0]!.url).toContain('/leaks/info')
    expect(res.driveFolder.url).toContain('drive.google.com')
  })

  it('downloadEntireDatabase hits /backup/info', async () => {
    const { client, calls } = make([
      {
        json: {
          success: true,
          name: 'Database Backups',
          driveFolder: { url: 'https://drive.google.com/drive/folders/def', name: 'x', type: 'y' },
        },
      },
    ])
    const res = await client.downloadEntireDatabase()
    expect(calls[0]!.url).toContain('/backup/info')
    expect(res.driveFolder.url).toContain('drive.google.com')
  })

  it('surfaces a 403 for non-MEGA keys as AuthError', async () => {
    const { client } = make([{ status: 403, json: { message: 'forbidden' } }])
    await expect(client.downloadEntireDatabase()).rejects.toBeInstanceOf(AuthError)
  })
})

describe('checkCached (money saver)', () => {
  it('cacheFirst: returns the cache hit without a live call', async () => {
    const { client, calls } = make([
      { json: { number: '59898297150', exists: true } },
    ])
    const res = await client.checkCached('59898297150')
    expect(res._source).toBe('cache')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toContain('/number_cache/59898297150')
  })

  it('cacheFirst: falls back to a live check on a 404 miss', async () => {
    const { client, calls } = make([
      { status: 404, json: { code: 'NOT_IN_DATABASE' } },
      { json: { number: '59898297150', exists: true } },
    ])
    const res = await client.checkCached('59898297150')
    expect(res._source).toBe('live')
    expect(calls).toHaveLength(2)
    expect(calls[0]!.url).toContain('/number_cache/')
    expect(calls[1]!.url).toContain('/number/59898297150')
  })

  it('cacheOnly: never makes a live call', async () => {
    const { client, calls } = make([{ status: 404, json: { code: 'NOT_IN_DATABASE' } }])
    const res = await client.checkCached('59898297150', { mode: 'cacheOnly' })
    expect(res._source).toBe('cache')
    expect(calls).toHaveLength(1)
  })

  it('live: always does a fresh /number call', async () => {
    const { client, calls } = make([{ json: { number: '59898297150' } }])
    const res = await client.checkCached('59898297150', { mode: 'live' })
    expect(res._source).toBe('live')
    expect(calls[0]!.url).toContain('/number/59898297150')
  })
})

describe('rapidapi transport', () => {
  it('routes cache reads to the db-only host with the host header', async () => {
    const { client, calls } = make(
      [{ json: { number: '59898297150', exists: true } }],
      { transport: 'rapidapi' }
    )
    await client.checkCached('59898297150')
    expect(calls[0]!.url).toBe(
      'https://wp-data-db-only.p.rapidapi.com/number_cache/59898297150'
    )
    expect(calls[0]!.headers['x-rapidapi-host']).toBe('wp-data-db-only.p.rapidapi.com')
  })

  it('routes live reads to the Number Validator host', async () => {
    const { client, calls } = make([{ json: {} }], { transport: 'rapidapi' })
    await client.getProfile('59898297150')
    expect(calls[0]!.url).toBe('https://whatsapp-number-validator18.p.rapidapi.com/number/59898297150')
    expect(calls[0]!.headers['x-rapidapi-host']).toBe('whatsapp-number-validator18.p.rapidapi.com')
  })
})

describe('edge cases (live status codes)', () => {
  it('getProfile returns the 404 body for a number not on WhatsApp (does not throw)', async () => {
    const notFound = {
      error: "Whatsapp number doesn't exist",
      status: 404,
      number: '14155552671',
      exists: false,
      code: 'NUMBER_NOT_FOUND',
      phone: '+1 415 555 2671',
    }
    const { client } = make([{ status: 404, json: notFound }])
    const res = await client.getProfile('14155552671')
    expect(res.exists).toBe(false)
    expect(res.code).toBe('NUMBER_NOT_FOUND')
    expect(res.number).toBe('14155552671')
  })

  it('getProfileNoPicture also returns the 404 body', async () => {
    const { client } = make([{ status: 404, json: { number: '1', exists: false } }])
    const res = await client.getProfileNoPicture('14155552671')
    expect(res.exists).toBe(false)
  })

  it('getProfile throws on a 400 invalid-number response', async () => {
    const { client } = make([{ status: 400, json: { error: 'Invalid phone number', success: null } }])
    await expect(client.getProfile('15550001234')).rejects.toBeInstanceOf(HttpError)
  })

  it('search returns an empty page (404) instead of throwing', async () => {
    const empty = {
      success: false,
      error: 'No results found for the given filters',
      data: { docs: [], totalDocs: null, limit: 3, page: 1, hasNextPage: false },
    }
    const { client } = make([{ status: 404, json: empty }])
    const res = await client.search({ countryCode: 'ZZ' })
    expect(res.success).toBe(false)
    expect(res.data.docs).toEqual([])
  })

  it('getLastPicture throws a clean error (with JSON body) when no picture (404)', async () => {
    const { client } = make([{ status: 404, json: { error: 'Profile picture not found' } }])
    await expect(client.getLastPicture('14155552671')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('checkCached cacheOnly miss synthesizes an entry with exists:false + number', async () => {
    const { client } = make([
      { status: 404, json: { error: 'not in DB', code: 'NOT_IN_DATABASE', status: 404 } },
    ])
    const res = await client.checkCached('59898297150', { mode: 'cacheOnly' })
    expect(res._source).toBe('cache')
    expect(res.exists).toBe(false)
    expect(res.number).toBe('59898297150')
    expect(res.code).toBe('NOT_IN_DATABASE')
  })

  it('telegram result exposes snake_case fields', async () => {
    const { client } = make([
      {
        json: {
          success: true,
          data: {
            '+59898297150': {
              id: 714847253,
              username: 'DeadAir94',
              first_name: 'Edu',
              last_name: 'Air',
              premium: true,
              hasPhoto: true,
            },
          },
        },
      },
    ])
    const res = await client.getTelegramProfile('59898297150')
    const entry = res.data['+59898297150']
    expect(entry?.first_name).toBe('Edu')
    expect(entry?.premium).toBe(true)
  })
})

describe('request config & retry safety', () => {
  it('per-request timeoutMs surfaces a TimeoutError', async () => {
    const client = new WhatsAppDataClient({ apiKey: 'k', fetch: hangingFetch, retries: 0 })
    await expect(
      client.getProfile('59898297150', { timeoutMs: 20 })
    ).rejects.toBeInstanceOf(TimeoutError)
  })

  it('an external AbortSignal cancels the request', async () => {
    const client = new WhatsAppDataClient({ apiKey: 'k', fetch: hangingFetch, retries: 0 })
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)
    await expect(
      client.getProfile('59898297150', { signal: controller.signal })
    ).rejects.toBeInstanceOf(WhatsAppDataError)
  })

  it('parses Retry-After (seconds) onto the RateLimitError', async () => {
    const { fetch } = mockFetch([
      { status: 429, json: { error: 'slow down' }, contentType: 'application/json' },
    ])
    // wrap fetch to add a retry-after header
    const withHeader: FetchLike = async (u, i) => {
      const r = await fetch(u, i)
      const h = new Headers(r.headers)
      h.set('retry-after', '2')
      return new Response(await r.text(), { status: r.status, headers: h })
    }
    const client = new WhatsAppDataClient({ apiKey: 'k', fetch: withHeader, retries: 0 })
    await client.carrierLookup('59898297150').then(
      () => {
        throw new Error('should have thrown')
      },
      (err) => {
        expect(err).toBeInstanceOf(RateLimitError)
        expect((err as RateLimitError).retryAfterMs).toBe(2000)
      }
    )
  })

  it('does NOT retry a POST (no double-spend) even on 5xx', async () => {
    const { fetch, calls } = mockFetch([{ status: 500, json: { error: 'boom' } }])
    const client = new WhatsAppDataClient({ apiKey: 'k', fetch, retryDelayMs: 1 })
    await expect(client.bulkCheck(['59898297150'])).rejects.toBeInstanceOf(HttpError)
    expect(calls).toHaveLength(1) // one attempt, not retries+1
  })

  it('clamps a negative retries so the request is still attempted once', async () => {
    const { fetch, calls } = mockFetch([{ json: { number: '1', exists: true } }])
    const client = new WhatsAppDataClient({ apiKey: 'k', fetch, retries: -5 })
    const res = await client.getProfile('59898297150')
    expect(res.exists).toBe(true)
    expect(calls).toHaveLength(1)
  })
})

describe('search filter encoding', () => {
  it('sends boolean filters explicitly, including false', async () => {
    const { client, calls } = make([{ json: { success: true, data: { docs: [] } } }])
    await client.search({ isBusiness: false, hasProfilePic: true })
    const url = calls[0]!.url
    expect(url).toContain('isBusiness=false')
    expect(url).toContain('hasProfilePic=true')
  })

  it('does not leak signal/timeoutMs/retries into the query string', async () => {
    const { client, calls } = make([{ json: { success: true, data: { docs: [] } } }])
    const controller = new AbortController()
    await client.search({ countryCode: 'UY', signal: controller.signal, timeoutMs: 5000, retries: 1 })
    const url = calls[0]!.url
    expect(url).not.toContain('signal')
    expect(url).not.toContain('timeoutMs')
    expect(url).not.toContain('retries')
  })
})

describe('checkCached authoritative negative', () => {
  it('treats a cached not-on-WhatsApp record (404 with a real card) as a HIT — no live call', async () => {
    const authoritativeNegative = {
      status: 404,
      json: {
        number: '14155552671',
        exists: false,
        code: 'NUMBER_NOT_FOUND',
        error: "Whatsapp number doesn't exist",
      },
    }
    const { client, calls } = make([authoritativeNegative])
    const res = await client.checkCached('14155552671')
    expect(res._source).toBe('cache')
    expect(res.exists).toBe(false)
    expect(calls).toHaveLength(1) // did NOT fall through to a live /number call
  })

  it('still falls through to live on a true NOT_IN_DATABASE miss', async () => {
    const { client, calls } = make([
      { status: 404, json: { code: 'NOT_IN_DATABASE', error: 'not in db' } },
      { json: { number: '59898297150', exists: true } },
    ])
    const res = await client.checkCached('59898297150')
    expect(res._source).toBe('live')
    expect(calls).toHaveLength(2)
  })
})

describe('error mapping', () => {
  it('maps 403 to AuthError', async () => {
    const { client } = make([{ status: 403, json: { message: 'not subscribed' } }])
    await expect(client.getProfile('59898297150')).rejects.toBeInstanceOf(AuthError)
  })

  it('maps 429 to RateLimitError (after retries)', async () => {
    const { client } = make([{ status: 429, json: { error: 'slow down' } }], {
      retries: 0,
    })
    await expect(client.carrierLookup('59898297150')).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('retries 5xx then succeeds', async () => {
    const { client, calls } = make(
      [
        { status: 500, json: { error: 'boom' } },
        { json: { number: '59898297150', exists: true } },
      ],
      { retryDelayMs: 1 }
    )
    const res = await client.getProfile('59898297150')
    expect(res.exists).toBe(true)
    expect(calls).toHaveLength(2)
  })
})
