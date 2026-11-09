import { AuthServiceError, type PhoneVerificationService } from '../types'
import { createMockOtpService } from './mockOtpService'

/**
 * Production stand-in while no SMS provider exists. Every call is rejected,
 * and `available: false` lets the Verify Phone screen explain the step is
 * deferred instead of rendering an OTP form that can never succeed.
 */
export const unavailablePhoneVerificationService: PhoneVerificationService = {
  available: false,
  async sendCode() {
    throw unavailable()
  },
  async resendCode() {
    throw unavailable()
  },
  async verifyCode() {
    throw unavailable()
  }
}

function unavailable() {
  return new AuthServiceError('PHONE_VERIFICATION_UNAVAILABLE', 'Phone verification isn’t available yet.')
}

let devService: PhoneVerificationService | null = null

/**
 * Picks the phone verification implementation for this build.
 *
 * In production builds `import.meta.env.DEV` is the literal `false`, so the
 * mock branch (and the fixed test code) is removed from the bundle.
 *
 * To add real SMS later, return the real provider here; the screen only
 * depends on the `PhoneVerificationService` interface.
 */
export function getPhoneVerificationService(): PhoneVerificationService {
  if (import.meta.env.DEV) {
    devService ??= createMockOtpService()
    return devService
  }
  return unavailablePhoneVerificationService
}
