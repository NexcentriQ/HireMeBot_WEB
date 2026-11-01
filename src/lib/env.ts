/**
 * Typed, validated access to the public (VITE_-prefixed) environment vars
 * the frontend consumes at runtime. All reads happen through this module so
 * missing or malformed configuration surfaces as one clear error instead of
 * silently falling back to an unintended default.
 *
 * The reader is intentionally LAZY — it re-evaluates on every call. This
 * lets tests use `vi.stubEnv` to switch modes between suites without
 * needing to reset module caches.
 *
 * This is NOT a place for secrets — only non-secret public configuration
 * lives in VITE_* variables (they are embedded into the client bundle).
 */

export type StudentApiMode = 'mock' | 'live'

export type AppEnv = {
  STUDENT_API_MODE: StudentApiMode
  API_BASE_URL: string | undefined
  DEV_STUDENT_ID: string | undefined
}

function readMode(raw: string | undefined): StudentApiMode {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'live') return 'live'
  // Default to mock when unset or anything unexpected — safer than live.
  return 'mock'
}

function readString(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Returns the current env snapshot. Call every time rather than caching —
 * the import.meta.env object is live under Vitest's `vi.stubEnv`.
 */
export function env(): AppEnv {
  return {
    STUDENT_API_MODE: readMode(import.meta.env.VITE_STUDENT_API_MODE as string | undefined),
    API_BASE_URL: readString(import.meta.env.VITE_API_BASE_URL as string | undefined),
    DEV_STUDENT_ID: readString(import.meta.env.VITE_DEV_STUDENT_ID as string | undefined)
  }
}

/**
 * Thrown when the frontend is configured for live mode but a required env
 * var is missing. Surfaces a clear developer message in the UI's error
 * boundary instead of a silent 404 / CORS mystery.
 */
export class MissingEnvError extends Error {
  constructor(missing: string[]) {
    super(
      `Missing required environment variables for VITE_STUDENT_API_MODE=live: ${missing.join(
        ', '
      )}. Set them in .env.local (see .env.example).`
    )
    this.name = 'MissingEnvError'
  }
}

/**
 * Thrown when a production build is configured for live mode. Live mode
 * today authenticates with the dev-only `X-Dev-Student-Id` header; shipping
 * that to a public deployment would allow any browser to impersonate any
 * student. Until Cognito/JWT replaces the header, live mode is restricted
 * to local development (import.meta.env.DEV).
 */
export class InsecureLiveModeError extends Error {
  constructor() {
    super(
      'VITE_STUDENT_API_MODE=live is not permitted in a production build: ' +
        'the dev-only X-Dev-Student-Id header is unsafe to expose publicly. ' +
        'Until Cognito/JWT lands, use mock mode for production builds or ' +
        'run `npm run dev` locally against the dev backend.'
    )
    this.name = 'InsecureLiveModeError'
  }
}

/**
 * Call before issuing a live request. Throws MissingEnvError with the
 * concrete list of truly-required missing vars.
 *
 * `apiBaseUrl` is intentionally optional: when unset the frontend uses
 * same-origin relative URLs (and the Vite dev proxy forwards /api to the
 * backend during development). Set `VITE_API_BASE_URL` only when the UI is
 * served from a different origin than the API.
 */
export function assertLiveEnv(): { apiBaseUrl: string; devStudentId: string } {
  const current = env()
  if (current.STUDENT_API_MODE !== 'live') {
    // Mock mode shouldn't be invoking live requests — return empty values;
    // callers (currently only `studentHttpGet`) guard this upstream.
    return { apiBaseUrl: '', devStudentId: '' }
  }
  // Hard refuse to run live mode in a production build. See InsecureLiveModeError.
  if (!import.meta.env.DEV) {
    throw new InsecureLiveModeError()
  }
  const missing: string[] = []
  if (!current.DEV_STUDENT_ID) missing.push('VITE_DEV_STUDENT_ID')
  if (missing.length > 0) throw new MissingEnvError(missing)
  return {
    apiBaseUrl: current.API_BASE_URL ?? '', // empty → same-origin (dev proxy)
    devStudentId: current.DEV_STUDENT_ID as string
  }
}
