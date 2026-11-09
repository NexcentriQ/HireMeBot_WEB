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
 * Public Amazon Cognito settings consumed by the Amplify configuration in
 * `src/features/auth/amplifyConfig.ts`. None of these are secrets: the app
 * client is a public client (no client secret) and these values ship in the
 * browser bundle by design. The Google OAuth client secret lives only inside
 * the Cognito user pool's identity-provider configuration in AWS.
 */
export type CognitoEnv = {
  userPoolId: string | undefined
  clientId: string | undefined
  /** Cognito domain without scheme or trailing slash, e.g. `xyz.auth.us-east-2.amazoncognito.com`. */
  domain: string | undefined
  /** Allowed OAuth callback URL(s). Comma-separated values are supported. */
  redirectSignIn: string[]
  /** Allowed sign-out URL(s). Comma-separated values are supported. */
  redirectSignOut: string[]
}

function readUrlList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

function normalizeDomain(raw: string | undefined): string | undefined {
  const value = readString(raw)
  if (!value) return undefined
  // Amplify expects the bare host. Tolerate a pasted `https://…/` value.
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Lazy snapshot of the Cognito env vars (re-evaluated on every call, like `env()`). */
export function cognitoEnv(): CognitoEnv {
  return {
    userPoolId: readString(import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined),
    clientId: readString(import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined),
    domain: normalizeDomain(import.meta.env.VITE_COGNITO_DOMAIN as string | undefined),
    redirectSignIn: readUrlList(import.meta.env.VITE_COGNITO_REDIRECT_URL as string | undefined),
    redirectSignOut: readUrlList(import.meta.env.VITE_COGNITO_SIGNOUT_URL as string | undefined)
  }
}

/**
 * Names of Cognito env vars that are missing or malformed. Empty when the
 * configuration is usable.
 */
export function missingCognitoEnv(current: CognitoEnv = cognitoEnv()): string[] {
  const missing: string[] = []
  if (!current.userPoolId) missing.push('VITE_COGNITO_USER_POOL_ID')
  if (!current.clientId) missing.push('VITE_COGNITO_CLIENT_ID')
  if (!current.domain) missing.push('VITE_COGNITO_DOMAIN')
  if (current.redirectSignIn.length === 0 || !current.redirectSignIn.every(isHttpUrl)) {
    missing.push('VITE_COGNITO_REDIRECT_URL')
  }
  if (current.redirectSignOut.length === 0 || !current.redirectSignOut.every(isHttpUrl)) {
    missing.push('VITE_COGNITO_SIGNOUT_URL')
  }
  return missing
}

/**
 * Endpoints of the student account API (`GET /api/v1/auth/me`,
 * `POST /api/v1/students/register`). See STUDENT_AUTH_API.md.
 *
 * Resolution order per endpoint:
 *   1. Full URL override (`VITE_ACCOUNT_LOOKUP_URL` / `VITE_STUDENT_REGISTRATION_URL`),
 *      i.e. the deployed stack outputs `AccountLookupUrl` / `StudentRegistrationUrl`.
 *   2. `VITE_API_BASE_URL` + the documented path (local: `http://127.0.0.1:3000`).
 *   3. Same-origin relative path (the Vite dev proxy forwards `/api`).
 *
 * Unlike the student dashboard API, these calls authenticate with the Cognito
 * access token, so they are used in every mode (mock and live).
 */
export type AccountApiEnv = {
  lookupUrl: string
  registrationUrl: string
  /** True when at least one source above was explicitly configured. */
  configured: boolean
}

export const ACCOUNT_LOOKUP_PATH = '/api/v1/auth/me'
export const STUDENT_REGISTRATION_PATH = '/api/v1/students/register'

function joinBase(base: string | undefined, path: string): string {
  if (!base) return path
  return `${base.replace(/\/+$/, '')}${path}`
}

export function accountApiEnv(): AccountApiEnv {
  const base = readString(import.meta.env.VITE_API_BASE_URL as string | undefined)
  const lookupOverride = readString(import.meta.env.VITE_ACCOUNT_LOOKUP_URL as string | undefined)
  const registrationOverride = readString(import.meta.env.VITE_STUDENT_REGISTRATION_URL as string | undefined)
  return {
    lookupUrl: lookupOverride ?? joinBase(base, ACCOUNT_LOOKUP_PATH),
    registrationUrl: registrationOverride ?? joinBase(base, STUDENT_REGISTRATION_PATH),
    configured: Boolean(base || (lookupOverride && registrationOverride))
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
