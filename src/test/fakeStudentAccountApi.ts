import { vi } from 'vitest'
import { configureStudentAccountApi } from '@/features/auth/services/studentAccountApi'
import { FAKE_ACCESS_TOKEN, getFakeCognitoUser } from './fakeAmplifyAuth'

/**
 * In-memory stand-in for the backend's student account API
 * (`GET /api/v1/auth/me`, `POST /api/v1/students/register`), installed for
 * every test by src/test/setup.ts through the API module's transport seam.
 * The real request/parse/retry code runs against it.
 *
 * Default: any signed-in fake Cognito user is a registered, ACTIVE student,
 * so existing dashboard tests need no setup. Tests opt into other states with
 * `setFakeAccount(sub, …)` or one-off `queueFakeAccountResponse(…)`.
 */

export type FakeAccount =
  | { type: 'registered'; status?: 'ACTIVE' | 'PENDING'; firstName?: string; lastName?: string; phoneNumber?: string }
  | { type: 'unregistered' }

export type FakeResponse = { status: number; body?: unknown; contentType?: string } | { networkError: true }

type Endpoint = 'lookup' | 'register'

export type FakeAccountApiCall = {
  endpoint: Endpoint
  method: string
  authorization: string | null
  body: unknown
}

const accounts = new Map<string, FakeAccount>()
const queued: Record<Endpoint, FakeResponse[]> = { lookup: [], register: [] }
export const fakeAccountApiCalls: FakeAccountApiCall[] = []

export function setFakeAccount(sub: string, account: FakeAccount): void {
  accounts.set(sub, account)
}

/** Answer the next request to `endpoint` with this response instead of the simulated backend. */
export function queueFakeAccountResponse(endpoint: Endpoint, response: FakeResponse): void {
  queued[endpoint].push(response)
}

export function fakeAccountApiCallCount(endpoint: Endpoint): number {
  return fakeAccountApiCalls.filter((c) => c.endpoint === endpoint).length
}

const REQUEST_ID = '68d329fa-7c7b-46b3-884b-70b13261ffd2'

function json(status: number, body: unknown): FakeResponse {
  return { status, body }
}

/** `studentId` the fake backend reports for every registered student. */
export const FAKE_STUDENT_ID = 1000000000

function studentPayload(sub: string, account: Extract<FakeAccount, { type: 'registered' }>) {
  const user = getFakeCognitoUser()
  return {
    userId: FAKE_STUDENT_ID,
    studentId: FAKE_STUDENT_ID,
    firstName: account.firstName ?? user?.givenName ?? 'Alex',
    lastName: account.lastName ?? user?.familyName ?? 'Smith',
    email: user?.email ?? `${sub}@gmail.com`,
    phoneNumber: account.phoneNumber ?? '+17135550101',
    emailVerified: true,
    phoneVerified: false,
    accountStatus: account.status ?? 'ACTIVE',
    accountType: 'STUDENT'
  }
}

function simulate(endpoint: Endpoint, authorization: string | null, body: unknown): FakeResponse {
  const user = getFakeCognitoUser()
  if (!user || authorization !== `Bearer ${FAKE_ACCESS_TOKEN}`) {
    return json(401, { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: REQUEST_ID })
  }
  const account = accounts.get(user.sub) ?? { type: 'registered' }

  if (endpoint === 'lookup') {
    if (account.type === 'unregistered') {
      return json(200, {
        success: true,
        registered: false,
        nextStep: 'SIGNUP_FORM',
        message: 'Complete your HireMeBot student registration.'
      })
    }
    return json(200, {
      success: true,
      registered: true,
      nextStep: account.status === 'PENDING' ? 'ACCOUNT_PENDING' : 'DASHBOARD',
      user: studentPayload(user.sub, account)
    })
  }

  // register
  if (account.type === 'registered') {
    return json(409, {
      success: false,
      code: 'ACCOUNT_ALREADY_REGISTERED',
      message: 'This Google account is already registered.',
      requestId: REQUEST_ID
    })
  }
  const input = (body ?? {}) as Record<string, unknown>
  if (input.acceptedTerms !== true) {
    return json(400, {
      success: false,
      code: 'VALIDATION_FAILED',
      message: 'Please provide valid registration details.',
      fieldErrors: [{ field: 'acceptedTerms', message: 'You must accept the Terms.' }],
      requestId: REQUEST_ID
    })
  }
  const registered: FakeAccount = {
    type: 'registered',
    status: 'ACTIVE',
    firstName: String(input.firstName),
    lastName: String(input.lastName),
    phoneNumber: String(input.phoneNumber)
  }
  accounts.set(user.sub, registered)
  return json(201, {
    success: true,
    code: 'STUDENT_REGISTERED',
    message: 'Student registered successfully',
    data: { ...studentPayload(user.sub, registered), nextStep: 'DASHBOARD' }
  })
}

async function simulateFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input)
  const endpoint: Endpoint | null = url.endsWith('/api/v1/auth/me')
    ? 'lookup'
    : url.endsWith('/api/v1/students/register')
      ? 'register'
      : null
  if (!endpoint) throw new Error(`fakeStudentAccountApi: unexpected URL ${url}`)

  const headers = new Headers(init?.headers)
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
  fakeAccountApiCalls.push({
    endpoint,
    method: init?.method ?? 'GET',
    authorization: headers.get('Authorization'),
    body
  })

  const response = queued[endpoint].shift() ?? simulate(endpoint, headers.get('Authorization'), body)
  if ('networkError' in response) throw new TypeError('Failed to fetch')
  return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
    status: response.status,
    headers: { 'Content-Type': response.contentType ?? 'application/json' }
  })
}

export const fakeAccountFetch = vi.fn(simulateFetch)

export function resetFakeStudentAccountApi(): void {
  accounts.clear()
  queued.lookup.length = 0
  queued.register.length = 0
  fakeAccountApiCalls.length = 0
  fakeAccountFetch.mockReset().mockImplementation(simulateFetch)
  // Instant backoff in tests; the 1 s / 2 s / 4 s schedule is asserted separately.
  configureStudentAccountApi({ fetch: fakeAccountFetch as unknown as typeof fetch, sleep: async () => {} })
}
