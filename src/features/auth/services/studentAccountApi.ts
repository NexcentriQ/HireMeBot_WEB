import { accountApiEnv } from '@/lib/env'
import { sleep } from '@/lib/utils'
import { getAccessToken } from './authService'

/**
 * Client for the student account API (STUDENT_AUTH_API.md):
 *
 *   GET  /api/v1/auth/me             who is this Cognito identity to HireMeBot?
 *   POST /api/v1/students/register   create the student for this identity
 *
 * Rules from the contract that this module enforces:
 * - Every request carries `Authorization: Bearer <Cognito ACCESS token>`,
 *   read from Amplify right before *each* attempt (Amplify refreshes it).
 *   Tokens are never cached, stored, or logged here.
 * - Identity comes only from the token: no email, sub, or "verified" flag is
 *   ever sent in a body.
 * - These endpoints use `{ success:false, code, message, requestId }`
 *   (branch on `code`, not `error`).
 * - API Gateway 401/403 bodies without `code` are treated as UNAUTHORIZED.
 * - 503 is retried with 1 s / 2 s / 4 s backoff.
 */

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export type NextStep = 'DASHBOARD' | 'ACCOUNT_PENDING' | 'SIGNUP_FORM'

export type StudentAccount = {
  userId: number
  studentId: number
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  emailVerified: boolean
  phoneVerified: boolean
  accountStatus: string
  accountType: string
}

export type AccountLookupResult =
  | { registered: true; nextStep: 'DASHBOARD' | 'ACCOUNT_PENDING'; user: StudentAccount }
  | { registered: false; nextStep: 'SIGNUP_FORM'; message: string | null }

export type StudentRegistrationInput = {
  firstName: string
  lastName: string
  /** E.164, e.g. `+17135550101`. */
  phoneNumber: string
  acceptedTerms: true
}

export type StudentRegistrationResult = {
  nextStep: 'DASHBOARD' | 'ACCOUNT_PENDING'
  student: StudentAccount
}

export type FieldError = { field: string; message: string }

/** Codes the backend documents, plus client-side codes for transport failures. */
export type AccountApiErrorCode =
  // backend
  | 'UNAUTHORIZED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_TYPE_MISMATCH'
  | 'GOOGLE_ACCOUNT_REQUIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_IDENTITY_CONFLICT'
  | 'ACCOUNT_ALREADY_REGISTERED'
  | 'NAME_ALREADY_REGISTERED'
  | 'VALIDATION_FAILED'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  // client
  | 'NO_SESSION'
  | 'NETWORK'
  | 'INVALID_RESPONSE'

/** Restricted identities: show the restricted/recovery screen, never the signup form. */
export const RESTRICTION_CODES = [
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
  'ACCOUNT_TYPE_MISMATCH',
  'GOOGLE_ACCOUNT_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_IDENTITY_CONFLICT'
] as const satisfies readonly AccountApiErrorCode[]

export type RestrictionCode = (typeof RESTRICTION_CODES)[number]

export function isRestrictionCode(code: string): code is RestrictionCode {
  return (RESTRICTION_CODES as readonly string[]).includes(code)
}

const DEFAULT_MESSAGES: Record<AccountApiErrorCode, string> = {
  UNAUTHORIZED: 'Your session has ended. Please continue with Google again.',
  NO_SESSION: 'Your session has ended. Please continue with Google again.',
  ACCOUNT_SUSPENDED: 'Your account is currently suspended.',
  ACCOUNT_DELETED: 'This account is unavailable.',
  ACCOUNT_TYPE_MISMATCH: 'This Google account belongs to a HireMeBot account that is not a student account.',
  GOOGLE_ACCOUNT_REQUIRED: 'Please sign in with Continue with Google.',
  EMAIL_NOT_VERIFIED: 'Google did not provide a verified email address for this account.',
  ACCOUNT_IDENTITY_CONFLICT:
    'An existing account requires a different sign-in or account recovery method.',
  ACCOUNT_ALREADY_REGISTERED: 'This Google account is already registered.',
  NAME_ALREADY_REGISTERED: 'An account with this name already exists. Please contact support.',
  VALIDATION_FAILED: 'Please provide valid registration details.',
  INVALID_REQUEST: 'Something went wrong while sending your details. Please try again.',
  PAYLOAD_TOO_LARGE: 'Something went wrong while sending your details. Please try again.',
  UNSUPPORTED_MEDIA_TYPE: 'Something went wrong while sending your details. Please try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'HireMeBot is temporarily unavailable. Please try again in a moment.',
  NETWORK: 'We couldn’t reach HireMeBot. Check your connection and try again.',
  INVALID_RESPONSE: 'We received an unexpected response. Please try again.'
}

export class AccountApiError extends Error {
  readonly status: number
  readonly code: AccountApiErrorCode
  readonly requestId: string | null
  readonly fieldErrors: FieldError[]

  constructor(args: {
    status: number
    code: AccountApiErrorCode
    message?: string | null
    requestId?: string | null
    fieldErrors?: FieldError[]
  }) {
    super(args.message || DEFAULT_MESSAGES[args.code])
    this.name = 'AccountApiError'
    this.status = args.status
    this.code = args.code
    this.requestId = args.requestId ?? null
    this.fieldErrors = args.fieldErrors ?? []
  }

  /** Session is missing or rejected: re-authenticate with Google. */
  get isUnauthorized(): boolean {
    return this.code === 'UNAUTHORIZED' || this.code === 'NO_SESSION'
  }

  get isRestriction(): boolean {
    return isRestrictionCode(this.code)
  }

  /** Worth a later "Try again" (server-side or connectivity problem). */
  get isRetryable(): boolean {
    return (
      this.code === 'SERVICE_UNAVAILABLE' ||
      this.code === 'INTERNAL_ERROR' ||
      this.code === 'NETWORK' ||
      this.code === 'INVALID_RESPONSE'
    )
  }
}

// ---------------------------------------------------------------------------
// Transport (injectable for tests)
// ---------------------------------------------------------------------------

type ApiConfig = {
  fetch: typeof fetch
  sleep: (ms: number) => Promise<unknown>
  /** Delays between retries of a 503. Contract: 1 s, 2 s, 4 s. */
  retryDelaysMs: readonly number[]
  timeoutMs: number
}

const DEFAULT_CONFIG: ApiConfig = {
  fetch: (...args) => globalThis.fetch(...args),
  sleep,
  retryDelaysMs: [1000, 2000, 4000],
  timeoutMs: 15_000
}

let config: ApiConfig = DEFAULT_CONFIG

/** Test seam: swap the transport/backoff. Call with no argument to restore defaults. */
export function configureStudentAccountApi(overrides?: Partial<ApiConfig>): void {
  config = overrides ? { ...DEFAULT_CONFIG, ...overrides } : DEFAULT_CONFIG
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** `GET /api/v1/auth/me`. Never creates an account. */
export async function lookupAccount(): Promise<AccountLookupResult> {
  const body = await request('GET', accountApiEnv().lookupUrl, undefined, { retryNetwork: true })
  return parseLookup(body)
}

/**
 * `POST /api/v1/students/register`. Only call after a lookup returned
 * `SIGNUP_FORM`. Sends exactly the four documented fields.
 *
 * Retrying is safe: a duplicate answers `409 ACCOUNT_ALREADY_REGISTERED` and
 * creates nothing. Network failures are *not* retried automatically (the
 * caller offers "Try again"); 503 is, per the contract.
 */
export async function registerStudent(input: StudentRegistrationInput): Promise<StudentRegistrationResult> {
  const payload: StudentRegistrationInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phoneNumber: input.phoneNumber,
    acceptedTerms: true
  }
  const body = await request('POST', accountApiEnv().registrationUrl, payload, { retryNetwork: false })
  return parseRegistration(body)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  let token: string | null
  try {
    token = await getAccessToken()
  } catch {
    token = null
  }
  if (!token) throw new AccountApiError({ status: 0, code: 'NO_SESSION' })
  return { Authorization: `Bearer ${token}` }
}

async function request(
  method: 'GET' | 'POST',
  url: string,
  payload: unknown,
  { retryNetwork }: { retryNetwork: boolean }
): Promise<unknown> {
  const delays = config.retryDelaysMs
  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptOnce(method, url, payload)
    } catch (err) {
      const retryable =
        err instanceof AccountApiError &&
        (err.code === 'SERVICE_UNAVAILABLE' || (retryNetwork && err.code === 'NETWORK'))
      if (!retryable || attempt >= delays.length) throw err
      await config.sleep(delays[attempt]!)
    }
  }
}

async function attemptOnce(method: 'GET' | 'POST', url: string, payload: unknown): Promise<unknown> {
  // Fresh token per attempt: Amplify refreshes an expired access token.
  const headers: Record<string, string> = { Accept: 'application/json', ...(await authHeaders()) }
  if (payload !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  let res: Response
  try {
    res = await config.fetch(url, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal
    })
  } catch {
    throw new AccountApiError({ status: 0, code: 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }

  const body = await readJson(res)
  if (res.ok) return body
  throw toApiError(res.status, body)
}

async function readJson(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return null
  try {
    return (await res.json()) as unknown
  } catch {
    return null
  }
}

const KNOWN_CODES = new Set<string>(Object.keys(DEFAULT_MESSAGES))

function toApiError(status: number, body: unknown): AccountApiError {
  const obj = isObject(body) ? body : {}
  const rawCode = typeof obj.code === 'string' ? obj.code : null
  const message = typeof obj.message === 'string' && obj.message.trim() ? obj.message : null
  const requestId = typeof obj.requestId === 'string' ? obj.requestId : null

  // API Gateway rejects bad tokens before the backend, with no `code`.
  if (!rawCode && (status === 401 || status === 403)) {
    return new AccountApiError({ status, code: 'UNAUTHORIZED' })
  }
  if (rawCode && KNOWN_CODES.has(rawCode)) {
    return new AccountApiError({
      status,
      code: rawCode as AccountApiErrorCode,
      message,
      requestId,
      fieldErrors: parseFieldErrors(obj.fieldErrors)
    })
  }
  // Unknown or missing code: classify by status.
  const code: AccountApiErrorCode =
    status === 401 ? 'UNAUTHORIZED' : status === 503 ? 'SERVICE_UNAVAILABLE' : status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_RESPONSE'
  return new AccountApiError({ status, code, message, requestId })
}

function parseFieldErrors(raw: unknown): FieldError[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) =>
    isObject(item) && typeof item.field === 'string' && typeof item.message === 'string'
      ? [{ field: item.field, message: item.message }]
      : []
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): AccountApiError {
  return new AccountApiError({ status: 200, code: 'INVALID_RESPONSE' })
}

function parseStudent(raw: unknown): StudentAccount {
  if (!isObject(raw)) throw invalidResponse()
  const num = (k: string) => (typeof raw[k] === 'number' ? (raw[k] as number) : NaN)
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : '')
  const userId = num('userId')
  if (!Number.isFinite(userId)) throw invalidResponse()
  return {
    userId,
    studentId: num('studentId'),
    firstName: str('firstName'),
    lastName: str('lastName'),
    email: str('email'),
    phoneNumber: str('phoneNumber'),
    emailVerified: raw.emailVerified === true,
    phoneVerified: raw.phoneVerified === true,
    accountStatus: str('accountStatus'),
    accountType: str('accountType')
  }
}

function parseLookup(body: unknown): AccountLookupResult {
  if (!isObject(body) || body.success !== true) throw invalidResponse()
  if (body.nextStep === 'SIGNUP_FORM' && body.registered === false) {
    return {
      registered: false,
      nextStep: 'SIGNUP_FORM',
      message: typeof body.message === 'string' ? body.message : null
    }
  }
  if ((body.nextStep === 'DASHBOARD' || body.nextStep === 'ACCOUNT_PENDING') && body.registered === true) {
    return { registered: true, nextStep: body.nextStep, user: parseStudent(body.user) }
  }
  throw invalidResponse()
}

function parseRegistration(body: unknown): StudentRegistrationResult {
  if (!isObject(body) || body.success !== true || !isObject(body.data)) throw invalidResponse()
  const nextStep = body.data.nextStep
  if (nextStep !== 'DASHBOARD' && nextStep !== 'ACCOUNT_PENDING') throw invalidResponse()
  return { nextStep, student: parseStudent(body.data) }
}
