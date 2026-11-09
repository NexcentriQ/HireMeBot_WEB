import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AccountApiError,
  configureStudentAccountApi,
  lookupAccount,
  registerStudent
} from '../services/studentAccountApi'
import { accountApiEnv } from '@/lib/env'
import { FAKE_ACCESS_TOKEN, fetchAuthSession, setFakeCognitoUser } from '@/test/fakeAmplifyAuth'

type Reply = { status: number; body?: unknown; contentType?: string } | 'network'

const fetchMock = vi.fn()
const sleepMock = vi.fn(async (_ms: number) => {})

function replies(...list: Reply[]) {
  for (const r of list) {
    fetchMock.mockImplementationOnce(async () => {
      if (r === 'network') throw new TypeError('Failed to fetch')
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': r.contentType ?? 'application/json' }
      })
    })
  }
}

const student = {
  userId: 1000000000,
  studentId: 1000000000,
  firstName: 'Alex',
  lastName: 'Smith',
  email: 'alex@gmail.com',
  phoneNumber: '+17135550101',
  emailVerified: true,
  phoneVerified: false,
  accountStatus: 'ACTIVE',
  accountType: 'STUDENT'
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)![1] as RequestInit
}

beforeEach(() => {
  fetchMock.mockReset()
  sleepMock.mockClear()
  configureStudentAccountApi({ fetch: fetchMock, sleep: sleepMock })
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000')
  setFakeCognitoUser({ sub: 'sub-1', email: 'alex@gmail.com' })
})

describe('GET /api/v1/auth/me', () => {
  it('sends the Cognito ACCESS token as a Bearer header, with no body and no caching', async () => {
    replies({ status: 200, body: { success: true, registered: true, nextStep: 'DASHBOARD', user: student } })
    const result = await lookupAccount()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:3000/api/v1/auth/me')
    const init = lastInit()
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.cache).toBe('no-store')
    expect(init.credentials).toBe('omit')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${FAKE_ACCESS_TOKEN}`)
    expect(result).toEqual({ registered: true, nextStep: 'DASHBOARD', user: student })
  })

  it('parses ACCOUNT_PENDING and SIGNUP_FORM', async () => {
    replies(
      { status: 200, body: { success: true, registered: true, nextStep: 'ACCOUNT_PENDING', user: { ...student, accountStatus: 'PENDING' } } },
      { status: 200, body: { success: true, registered: false, nextStep: 'SIGNUP_FORM', message: 'Complete your HireMeBot student registration.' } }
    )
    expect((await lookupAccount()).nextStep).toBe('ACCOUNT_PENDING')
    expect(await lookupAccount()).toEqual({
      registered: false,
      nextStep: 'SIGNUP_FORM',
      message: 'Complete your HireMeBot student registration.'
    })
  })

  it('reads the token from Amplify right before every attempt (never caches it)', async () => {
    replies({ status: 503, body: { success: false, code: 'SERVICE_UNAVAILABLE' } }, { status: 200, body: { success: true, registered: false, nextStep: 'SIGNUP_FORM' } })
    fetchAuthSession.mockClear()
    await lookupAccount()
    expect(fetchAuthSession).toHaveBeenCalledTimes(2)
  })

  it('fails with NO_SESSION, without calling the API, when Amplify has no access token', async () => {
    setFakeCognitoUser(null)
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'NO_SESSION', isUnauthorized: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps the documented error envelope (code, message, requestId)', async () => {
    replies({
      status: 403,
      body: { success: false, code: 'ACCOUNT_SUSPENDED', message: 'Your account is currently suspended.', requestId: 'req-1' }
    })
    const err = (await lookupAccount().catch((e) => e)) as AccountApiError
    expect(err).toBeInstanceOf(AccountApiError)
    expect(err).toMatchObject({ status: 403, code: 'ACCOUNT_SUSPENDED', requestId: 'req-1', isRestriction: true })
    expect(err.message).toBe('Your account is currently suspended.')
  })

  it.each([
    [401, { message: 'Unauthorized' }],
    [403, { message: 'Forbidden' }]
  ])('treats an API Gateway %i without `code` as UNAUTHORIZED', async (status, body) => {
    replies({ status, body })
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'UNAUTHORIZED', isUnauthorized: true })
  })

  it('retries 503 with 1 s, 2 s, 4 s backoff, then gives up', async () => {
    const unavailable = { status: 503, body: { success: false, code: 'SERVICE_UNAVAILABLE', requestId: 'r' } }
    replies(unavailable, unavailable, unavailable, unavailable)
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', isRetryable: true })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(sleepMock.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000])
  })

  it('recovers when a retry succeeds', async () => {
    replies(
      { status: 503, body: { success: false, code: 'SERVICE_UNAVAILABLE' } },
      { status: 200, body: { success: true, registered: true, nextStep: 'DASHBOARD', user: student } }
    )
    expect((await lookupAccount()).nextStep).toBe('DASHBOARD')
  })

  it('does not retry definitive answers (403, 409, 500)', async () => {
    replies({ status: 409, body: { success: false, code: 'ACCOUNT_IDENTITY_CONFLICT', message: 'm' } })
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'ACCOUNT_IDENTITY_CONFLICT' })
    replies({ status: 500, body: { success: false, code: 'INTERNAL_ERROR', requestId: 'abc' } })
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'abc' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a network failure for the idempotent lookup', async () => {
    replies('network', { status: 200, body: { success: true, registered: false, nextStep: 'SIGNUP_FORM' } })
    expect((await lookupAccount()).nextStep).toBe('SIGNUP_FORM')
  })

  it('rejects an unexpected response shape (e.g. the SPA index.html)', async () => {
    replies({ status: 200, body: '<!doctype html>', contentType: 'text/html' })
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    replies({ status: 200, body: { success: true, registered: true, nextStep: 'SOMETHING_NEW', user: student } })
    await expect(lookupAccount()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})

describe('POST /api/v1/students/register', () => {
  const input = { firstName: ' Alex ', lastName: 'Smith', phoneNumber: '+17135550101', acceptedTerms: true as const }

  it('sends exactly the four documented fields as JSON with the Bearer token', async () => {
    replies({ status: 201, body: { success: true, code: 'STUDENT_REGISTERED', data: { ...student, nextStep: 'DASHBOARD' } } })
    const result = await registerStudent({ ...input, email: 'evil@example.com', phoneVerified: true } as typeof input)

    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:3000/api/v1/students/register')
    const init = lastInit()
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBe(`Bearer ${FAKE_ACCESS_TOKEN}`)
    expect(JSON.parse(init.body as string)).toEqual({
      firstName: 'Alex',
      lastName: 'Smith',
      phoneNumber: '+17135550101',
      acceptedTerms: true
    })
    expect(result).toEqual({ nextStep: 'DASHBOARD', student })
  })

  it('surfaces VALIDATION_FAILED field errors', async () => {
    replies({
      status: 400,
      body: {
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Please provide valid registration details.',
        fieldErrors: [{ field: 'phoneNumber', message: 'Enter a valid phone number in international format, e.g. +17135550101.' }],
        requestId: 'req-2'
      }
    })
    await expect(registerStudent(input)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [{ field: 'phoneNumber', message: 'Enter a valid phone number in international format, e.g. +17135550101.' }]
    })
  })

  it('does not auto-retry a network failure (the user decides; a duplicate would 409)', async () => {
    replies('network')
    await expect(registerStudent(input)).rejects.toMatchObject({ code: 'NETWORK', isRetryable: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries 503 per the contract', async () => {
    replies(
      { status: 503, body: { success: false, code: 'SERVICE_UNAVAILABLE' } },
      { status: 201, body: { success: true, data: { ...student, nextStep: 'DASHBOARD' } } }
    )
    expect((await registerStudent(input)).nextStep).toBe('DASHBOARD')
    expect(sleepMock).toHaveBeenCalledWith(1000)
  })
})

describe('account API URLs', () => {
  it('uses VITE_API_BASE_URL with the documented paths', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000/')
    expect(accountApiEnv()).toMatchObject({
      lookupUrl: 'http://127.0.0.1:3000/api/v1/auth/me',
      registrationUrl: 'http://127.0.0.1:3000/api/v1/students/register'
    })
  })

  it('prefers the deployed stack-output URLs when set', () => {
    vi.stubEnv('VITE_ACCOUNT_LOOKUP_URL', 'https://a.example/Prod/api/v1/auth/me')
    vi.stubEnv('VITE_STUDENT_REGISTRATION_URL', 'https://b.example/Prod/api/v1/students/register')
    expect(accountApiEnv()).toMatchObject({
      lookupUrl: 'https://a.example/Prod/api/v1/auth/me',
      registrationUrl: 'https://b.example/Prod/api/v1/students/register'
    })
  })

  it('falls back to same-origin paths (Vite dev proxy) when nothing is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(accountApiEnv()).toMatchObject({
      lookupUrl: '/api/v1/auth/me',
      registrationUrl: '/api/v1/students/register',
      configured: false
    })
  })
})
