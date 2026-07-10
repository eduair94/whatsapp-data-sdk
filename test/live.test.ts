import { beforeAll, describe, expect, it } from 'vitest'
import { WhatsAppDataClient } from '../src/index.js'

/**
 * Live smoke tests against the real proxy. Skipped unless both `LIVE=1` and a
 * key are provided, so the default `npm test` stays offline & deterministic.
 *
 *   WA_API_KEY=<your key> npm run test:live
 *
 * `WA_TRANSPORT` (proxy|rapidapi) and `WA_TEST_NUMBER` are optional overrides.
 */
const apiKey = process.env.WA_API_KEY
const enabled = process.env.LIVE === '1' && !!apiKey
const number = process.env.WA_TEST_NUMBER ?? '59898297150'

describe.skipIf(!enabled)('live smoke (proxy)', () => {
  let client: WhatsAppDataClient
  beforeAll(() => {
    client = new WhatsAppDataClient({
      apiKey: apiKey ?? '',
      transport: (process.env.WA_TRANSPORT as 'proxy' | 'rapidapi') ?? 'proxy',
    })
  })

  it('getProfile returns an entry', { timeout: 60000 }, async () => {
    const res = await client.getProfile(number, { ignoreProfilePic: true })
    expect(res.number).toBeTypeOf('string')
  })

  it('carrierLookup returns carrier data', { timeout: 30000 }, async () => {
    const res = await client.carrierLookup(number)
    expect(res).toHaveProperty('success')
  })

  it('checkCached cacheOnly reads the DB', { timeout: 30000 }, async () => {
    const res = await client.checkCached(number, { mode: 'cacheOnly' })
    expect(res._source).toBe('cache')
  })

  it('downloadEntireDatabase returns a drive link (MEGA key)', { timeout: 30000 }, async () => {
    const res = await client.downloadEntireDatabase()
    expect(res.driveFolder.url).toContain('drive.google.com')
  })

  it('getLeakedNumbersInfo returns a drive link (MEGA key)', { timeout: 30000 }, async () => {
    const res = await client.getLeakedNumbersInfo()
    expect(res.driveFolder.url).toContain('drive.google.com')
  })

  it('getProfile returns exists:false for a number not on WhatsApp (404, no throw)', { timeout: 60000 }, async () => {
    const res = await client.getProfile('14155552671', { ignoreProfilePic: true })
    expect(res.exists).toBe(false)
    expect(res.number).toBe('14155552671')
  })

  it('search with no matches returns an empty page (404, no throw)', { timeout: 30000 }, async () => {
    const res = await client.search({ countryCode: 'ZZ', limit: 2 })
    expect(res.success).toBe(false)
    expect(res.data.docs).toEqual([])
  })

  it('getProfile throws HttpError on an invalid number (400)', { timeout: 30000 }, async () => {
    await expect(client.getProfile('15550001234')).rejects.toMatchObject({ status: 400 })
  })

  it('carrierLookup includes location and metadata', { timeout: 30000 }, async () => {
    const res = await client.carrierLookup('14155552671')
    expect(res.success).toBe(true)
    expect(typeof res.location).toBe('string')
  })
})
