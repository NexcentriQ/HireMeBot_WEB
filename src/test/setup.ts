import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  // Clear any `vi.stubEnv` set by individual tests so one test's live-mode
  // stubs can't leak into the next (otherwise .env.local's "live" wins).
  vi.unstubAllEnvs()
})

beforeEach(() => {
  // Force mock mode by default across every test file. Individual tests
  // (e.g. liveStudentService.test.ts) opt in to live by re-stubbing.
  // Must happen BEFORE the test imports touch `env()` for the first time.
  vi.stubEnv('VITE_STUDENT_API_MODE', 'mock')
  vi.stubEnv('VITE_API_BASE_URL', '')
  vi.stubEnv('VITE_DEV_STUDENT_ID', '1000000002')

  // Provide a stable matchMedia so ThemeProvider does not fail in jsdom.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})
