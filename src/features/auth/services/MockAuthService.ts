import { sleep } from '@/lib/utils'
import {
  type ActivateAccountInput,
  type AuthService,
  AuthServiceError,
  type AuthenticatedUser,
  type GoogleAuthenticationResult,
  type PendingRegistration,
  type ResendOtpResult,
  type StartGoogleAuthOptions,
  type StartRegistrationInput,
  type VerifyPhoneOtpInput
} from '../types'

/**
 * Development-only authentication adapter.
 *
 * SECURITY: This service is NOT a backend. It persists mock state in
 * localStorage so the flow can be demonstrated end-to-end on the frontend.
 * The accepted mock OTP is "123456". Real backend contracts must replace this.
 */

const REG_KEY = 'hmb.mock.pendingRegistration'
const USER_KEY = 'hmb.mock.user'
const RESEND_KEY = 'hmb.mock.lastResend'
const RESEND_WINDOW_SECONDS = 60
const PENDING_TTL_MS = 1000 * 60 * 15

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function remove(key: string) {
  window.localStorage.removeItem(key)
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function loadPending(): PendingRegistration | null {
  const pending = readJson<PendingRegistration>(REG_KEY)
  if (!pending) return null
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) {
    remove(REG_KEY)
    return null
  }
  return pending
}

export class MockAuthService implements AuthService {
  async startRegistration(input: StartRegistrationInput): Promise<PendingRegistration> {
    if (!input.agreedToTerms) {
      throw new AuthServiceError('UNKNOWN', 'You must agree to the Terms of Service and Privacy Policy.')
    }
    await sleep(500)
    const pending: PendingRegistration = {
      registrationId: randomId('reg'),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phoneE164: input.phoneE164,
      phoneVerified: false,
      createdAt: Date.now()
    }
    writeJson(REG_KEY, pending)
    writeJson(RESEND_KEY, { at: Date.now() })
    return pending
  }

  async sendPhoneOtp(registrationId: string): Promise<ResendOtpResult> {
    const pending = loadPending()
    if (!pending || pending.registrationId !== registrationId) {
      throw new AuthServiceError('REGISTRATION_NOT_FOUND', 'Registration not found. Start again.')
    }
    writeJson(RESEND_KEY, { at: Date.now() })
    await sleep(300)
    return { nextResendInSeconds: RESEND_WINDOW_SECONDS }
  }

  async verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<PendingRegistration> {
    const pending = loadPending()
    if (!pending || pending.registrationId !== input.registrationId) {
      throw new AuthServiceError('REGISTRATION_NOT_FOUND', 'Registration not found. Start again.')
    }
    await sleep(400)
    if (input.code !== '123456') {
      throw new AuthServiceError('INVALID_OTP', 'Incorrect code. Please try again.')
    }
    const verified: PendingRegistration = { ...pending, phoneVerified: true }
    writeJson(REG_KEY, verified)
    return verified
  }

  async resendPhoneOtp(registrationId: string): Promise<ResendOtpResult> {
    const last = readJson<{ at: number }>(RESEND_KEY)
    const now = Date.now()
    if (last && now - last.at < RESEND_WINDOW_SECONDS * 1000) {
      const remaining = Math.ceil((RESEND_WINDOW_SECONDS * 1000 - (now - last.at)) / 1000)
      throw new AuthServiceError('RESEND_THROTTLED', `Please wait ${remaining}s before requesting a new code.`)
    }
    return this.sendPhoneOtp(registrationId)
  }

  async startGoogleAuthentication(_opts: StartGoogleAuthOptions): Promise<{ redirectUrl: string }> {
    const pending = loadPending()
    if (pending && !pending.phoneVerified) {
      throw new AuthServiceError('PHONE_NOT_VERIFIED', 'Please verify your phone number before continuing.')
    }
    // In the mock flow we land directly on the callback route to simulate a
    // successful Google round-trip without external network dependencies.
    await sleep(300)
    const url = `${window.location.origin}/auth/callback?mock=1`
    return { redirectUrl: url }
  }

  async completeGoogleAuthentication(callbackParams: Record<string, string>): Promise<GoogleAuthenticationResult> {
    await sleep(500)
    if (callbackParams.error) {
      throw new AuthServiceError('GOOGLE_CANCELLED', 'Google sign-in was cancelled.')
    }
    const pending = loadPending()
    const email = pending
      ? `${pending.firstName.toLowerCase()}.${pending.lastName.toLowerCase()}@example.com`
      : 'student@example.com'
    return {
      sessionRef: randomId('sess'),
      email,
      emailVerified: true
    }
  }

  async activateStudentAccount(input: ActivateAccountInput): Promise<AuthenticatedUser> {
    const pending = loadPending()
    if (!pending || pending.registrationId !== input.registrationId) {
      throw new AuthServiceError('REGISTRATION_NOT_FOUND', 'Registration not found. Start again.')
    }
    if (!pending.phoneVerified) {
      throw new AuthServiceError('PHONE_NOT_VERIFIED', 'Phone verification is required.')
    }
    await sleep(500)
    const user: AuthenticatedUser = {
      id: randomId('usr'),
      role: 'STUDENT',
      firstName: pending.firstName,
      lastName: pending.lastName,
      email: `${pending.firstName.toLowerCase()}.${pending.lastName.toLowerCase()}@example.com`,
      phoneE164: pending.phoneE164,
      activated: true
    }
    writeJson(USER_KEY, user)
    remove(REG_KEY)
    remove(RESEND_KEY)
    return user
  }

  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    return readJson<AuthenticatedUser>(USER_KEY)
  }

  async logout(): Promise<void> {
    remove(USER_KEY)
    remove(REG_KEY)
    remove(RESEND_KEY)
  }
}

export const mockAuthService = new MockAuthService()

/** Helper used by UI to read the current pending registration (never a secret). */
export function readPendingRegistration(): PendingRegistration | null {
  return loadPending()
}

export const MOCK_OTP_CODE = '123456'
