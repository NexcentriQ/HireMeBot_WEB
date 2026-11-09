/**
 * Identity of the signed-in user as reported by Amazon Cognito.
 *
 * Built from the Cognito ID token that Amplify received directly from the
 * Cognito token endpoint. Fields are suitable for display and routing only —
 * the browser does not verify JWT signatures, so any authorization decision
 * (student role, onboarding state, phone verification) must be made by the
 * backend after it verifies the token.
 *
 * Deliberately absent: `role`, `activated`, `phoneVerified`. Cognito is not
 * configured to issue those claims and the frontend must not invent them.
 */
export type AuthUser = {
  /** Cognito `sub` — the immutable, canonical identity key. Never link accounts by email. */
  userId: string
  /** Cognito username (federated users look like `google_1234…`). */
  username: string
  email: string | null
  /** `email_verified` claim as issued by Cognito (display hint only). */
  emailVerified: boolean | null
  givenName: string | null
  familyName: string | null
  /** Federated provider name from the `identities` claim, e.g. `Google`. */
  identityProvider: string | null
}

/** Which UI journey started a Google redirect. Drives where the callback lands. */
export type SignInFlow = 'login' | 'signup'

export type AuthErrorCode =
  | 'NOT_CONFIGURED'
  | 'REDIRECT_MISMATCH'
  | 'GOOGLE_CANCELLED'
  | 'GOOGLE_SIGN_IN_FAILED'
  | 'ALREADY_SIGNED_IN'
  | 'SESSION_UNAVAILABLE'
  | 'NETWORK'
  | 'INVALID_OTP'
  | 'INVALID_OTP_FORMAT'
  | 'RESEND_THROTTLED'
  | 'PHONE_VERIFICATION_UNAVAILABLE'
  | 'UNKNOWN'

/**
 * User-safe error. `message` is always suitable for display: it never
 * contains tokens, secrets, or raw SDK exception text in production builds.
 */
export class AuthServiceError extends Error {
  code: AuthErrorCode

  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthServiceError'
  }
}

export type ResendOtpResult = {
  nextResendInSeconds: number
}

/**
 * Result of a phone-code check.
 *
 * `dev-simulated` means the development-only mock accepted the fixed test
 * code. It is NOT evidence that the user owns the phone number and must never
 * be persisted or sent anywhere as `phone_verified=true`. A future real
 * provider would return a server-issued, server-verifiable proof instead.
 */
export type PhoneCodeCheckResult = {
  outcome: 'dev-simulated'
}

/**
 * Seam for phone verification so a real SMS provider (Cognito SMS, a backend
 * OTP endpoint, …) can replace the development mock without touching the
 * Verify Phone screen.
 */
export interface PhoneVerificationService {
  /** `false` when no verification provider exists in this build (production today). */
  readonly available: boolean
  sendCode(phoneE164: string): Promise<ResendOtpResult>
  resendCode(phoneE164: string): Promise<ResendOtpResult>
  verifyCode(phoneE164: string, code: string): Promise<PhoneCodeCheckResult>
}
