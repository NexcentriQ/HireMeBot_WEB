import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Env-level guards. The lazy `env()` reader means we can switch mode per
 * test via `vi.stubEnv` without resetting modules.
 */
describe('env.ts guards', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('assertLiveEnv returns an empty base URL in mock mode and does not throw', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'mock')
    const { assertLiveEnv } = await import('../env')
    expect(() => assertLiveEnv()).not.toThrow()
    expect(assertLiveEnv()).toEqual({ apiBaseUrl: '' })
  })

  it('assertLiveEnv refuses live mode in a production build', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', '')
    // Vite exposes DEV / PROD on import.meta.env. Flip them for this test.
    vi.stubEnv('DEV', false)
    vi.stubEnv('PROD', true)
    const { assertLiveEnv, InsecureLiveModeError } = await import('../env')
    expect(() => assertLiveEnv()).toThrow(InsecureLiveModeError)
    try {
      assertLiveEnv()
    } catch (e) {
      expect((e as Error).message).toMatch(/not permitted in a production build/i)
    }
  })

  it('assertLiveEnv succeeds in a dev build and needs no student id env var', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000')
    vi.stubEnv('VITE_DEV_STUDENT_ID', '') // the old variable is ignored
    vi.stubEnv('DEV', true)
    const { assertLiveEnv } = await import('../env')
    expect(assertLiveEnv()).toEqual({ apiBaseUrl: 'http://127.0.0.1:3000' })
  })

  it('assertLiveEnv falls back to same-origin (empty base URL) when VITE_API_BASE_URL is unset', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('DEV', true)
    const { assertLiveEnv } = await import('../env')
    expect(assertLiveEnv()).toEqual({ apiBaseUrl: '' })
  })
})
