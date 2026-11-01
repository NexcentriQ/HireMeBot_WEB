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

  it('assertLiveEnv returns empty strings in mock mode and does not throw', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'mock')
    const { assertLiveEnv } = await import('../env')
    expect(() => assertLiveEnv()).not.toThrow()
    const { apiBaseUrl, devStudentId } = assertLiveEnv()
    expect(apiBaseUrl).toBe('')
    expect(devStudentId).toBe('')
  })

  it('assertLiveEnv throws MissingEnvError in live mode when VITE_DEV_STUDENT_ID is unset', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_DEV_STUDENT_ID', '')
    // Pretend we're in dev build so we clear the prod guard first.
    vi.stubEnv('DEV', true)
    const { assertLiveEnv, MissingEnvError } = await import('../env')
    expect(() => assertLiveEnv()).toThrow(MissingEnvError)
  })

  it('assertLiveEnv refuses live mode in a production build', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_DEV_STUDENT_ID', '1000000002')
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

  it('assertLiveEnv succeeds in a dev build with all required vars set', async () => {
    vi.stubEnv('VITE_STUDENT_API_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000')
    vi.stubEnv('VITE_DEV_STUDENT_ID', '1000000002')
    vi.stubEnv('DEV', true)
    const { assertLiveEnv } = await import('../env')
    const { apiBaseUrl, devStudentId } = assertLiveEnv()
    expect(apiBaseUrl).toBe('http://127.0.0.1:3000')
    expect(devStudentId).toBe('1000000002')
  })
})
