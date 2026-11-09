import { sleep } from '@/lib/utils'
import { AuthServiceError, type PhoneVerificationService, type ResendOtpResult } from '../types'

/**
 * DEVELOPMENT-ONLY phone OTP simulation.
 *
 * Exists so the existing Verify Phone screen can be exercised while real SMS
 * delivery is deferred (AWS End User Messaging SMS is unavailable on the
 * current AWS Free plan). It sends nothing and verifies nothing:
 *
 * - Accepts only the fixed code below, and only when `import.meta.env.DEV`.
 * - Every method re-checks `import.meta.env.DEV`, so even if this module were
 *   wired into a production build by mistake it would reject all calls.
 * - A successful check returns `dev-simulated`, never "verified".
 *
 * Production builds select `unavailablePhoneVerificationService` instead (see
 * phoneVerification.ts); Vite's dead-code elimination drops this module.
 */
export const DEV_MOCK_OTP_CODE = '123456'
export const MOCK_RESEND_WINDOW_SECONDS = 60

function assertDevelopmentBuild(): void {
  if (!import.meta.env.DEV) {
    throw new AuthServiceError(
      'PHONE_VERIFICATION_UNAVAILABLE',
      'Phone verification isn’t available yet.'
    )
  }
}

export function createMockOtpService(options: { latencyMs?: number } = {}): PhoneVerificationService {
  const latencyMs = options.latencyMs ?? 300
  const lastSentAt = new Map<string, number>()

  async function sendCode(phoneE164: string): Promise<ResendOtpResult> {
    assertDevelopmentBuild()
    lastSentAt.set(phoneE164, Date.now())
    if (latencyMs) await sleep(latencyMs)
    return { nextResendInSeconds: MOCK_RESEND_WINDOW_SECONDS }
  }

  return {
    available: true,

    sendCode,

    async resendCode(phoneE164) {
      assertDevelopmentBuild()
      const last = lastSentAt.get(phoneE164)
      const elapsedMs = last === undefined ? Infinity : Date.now() - last
      if (elapsedMs < MOCK_RESEND_WINDOW_SECONDS * 1000) {
        const remaining = Math.ceil((MOCK_RESEND_WINDOW_SECONDS * 1000 - elapsedMs) / 1000)
        throw new AuthServiceError('RESEND_THROTTLED', `Please wait ${remaining}s before requesting a new code.`)
      }
      return sendCode(phoneE164)
    },

    async verifyCode(_phoneE164, code) {
      assertDevelopmentBuild()
      if (!/^\d{6}$/.test(code)) {
        throw new AuthServiceError('INVALID_OTP_FORMAT', 'Enter the 6-digit code.')
      }
      if (latencyMs) await sleep(latencyMs)
      if (code !== DEV_MOCK_OTP_CODE) {
        throw new AuthServiceError('INVALID_OTP', 'Incorrect code. Please try again.')
      }
      return { outcome: 'dev-simulated' }
    }
  }
}
