import { describe, expect, it } from 'vitest'
import {
  resolveConfig,
  PROXY_BASE_URL,
  RAPIDAPI_LIVE_HOST,
  RAPIDAPI_CACHE_HOST,
  ValidationError,
} from '../src/index.js'

describe('resolveConfig', () => {
  it('defaults to the proxy transport (single host, no rapidapi host header)', () => {
    const cfg = resolveConfig({ apiKey: 'k', fetch: async () => new Response() })
    expect(cfg.transport).toBe('proxy')
    expect(cfg.live.baseUrl).toBe(PROXY_BASE_URL)
    expect(cfg.live.host).toBeUndefined()
    // proxy cache shares the base and differs only by path
    expect(cfg.cache.baseUrl).toBe(PROXY_BASE_URL)
    expect(cfg.cache.host).toBeUndefined()
  })

  it('resolves rapidapi live + db-only hosts', () => {
    const cfg = resolveConfig({
      apiKey: 'k',
      transport: 'rapidapi',
      fetch: async () => new Response(),
    })
    expect(cfg.live.baseUrl).toBe(`https://${RAPIDAPI_LIVE_HOST}`)
    expect(cfg.live.host).toBe(RAPIDAPI_LIVE_HOST)
    expect(cfg.cache.baseUrl).toBe(`https://${RAPIDAPI_CACHE_HOST}`)
    expect(cfg.cache.host).toBe(RAPIDAPI_CACHE_HOST)
  })

  it('honors custom base URLs and strips trailing slashes', () => {
    const cfg = resolveConfig({
      apiKey: 'k',
      baseUrl: 'https://example.com/',
      fetch: async () => new Response(),
    })
    expect(cfg.live.baseUrl).toBe('https://example.com')
  })

  it('throws without an apiKey', () => {
    // @ts-expect-error missing apiKey
    expect(() => resolveConfig({ fetch: async () => new Response() })).toThrow(
      ValidationError
    )
  })

  it('throws on an unknown transport', () => {
    expect(() =>
      // @ts-expect-error bad transport
      resolveConfig({ apiKey: 'k', transport: 'nope', fetch: async () => new Response() })
    ).toThrow(ValidationError)
  })
})
