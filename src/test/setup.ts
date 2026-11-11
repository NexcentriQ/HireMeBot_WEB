import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetFakeAmplifyAuth } from './fakeAmplifyAuth'
import { resetFakeStudentAccountApi } from './fakeStudentAccountApi'

// Every test talks to an in-memory fake instead of real Amazon Cognito.
vi.mock('aws-amplify/auth', () => import('./fakeAmplifyAuth'))

// jsdom lacks ResizeObserver, which Radix primitives (e.g. Checkbox) use.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetFakeAmplifyAuth()
  // Clear any `vi.stubEnv` set by individual tests so one test's live-mode
  // stubs can't leak into the next (otherwise .env.local's "live" wins).
  vi.unstubAllEnvs()
})

beforeEach(() => {
  // Student account API (GET /auth/me, POST /students/register) answers from
  // an in-memory backend. Signed-in fake users default to ACTIVE students.
  resetFakeStudentAccountApi()

  // Force mock mode by default across every test file. Individual tests
  // (e.g. liveStudentService.test.ts) opt in to live by re-stubbing.
  // Must happen BEFORE the test imports touch `env()` for the first time.
  vi.stubEnv('VITE_STUDENT_API_MODE', 'mock')
  vi.stubEnv('VITE_API_BASE_URL', '')

  // Deterministic Cognito config matching jsdom's default origin
  // (http://localhost:3000) so redirect-origin checks pass by default.
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-2_TESTPOOL')
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'testclientid')
  vi.stubEnv('VITE_COGNITO_DOMAIN', 'test-domain.auth.us-east-2.amazoncognito.com')
  vi.stubEnv('VITE_COGNITO_REDIRECT_URL', 'http://localhost:3000/auth/callback')
  vi.stubEnv('VITE_COGNITO_SIGNOUT_URL', 'http://localhost:3000/')

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
