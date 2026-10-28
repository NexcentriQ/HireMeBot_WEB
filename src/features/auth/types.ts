export type UserRole = 'STUDENT' | 'RECRUITER' | 'MANAGER'

export type AuthenticatedUser = {
  id: string
  role: UserRole
  firstName: string
  lastName: string
  email: string
  phoneE164: string
  activated: boolean
}

/** Non-sensitive handle for a server-side pending registration. */
export type PendingRegistration = {
  registrationId: string
  firstName: string
  lastName: string
  phoneE164: string
  phoneVerified: boolean
  createdAt: number
}

export type StartRegistrationInput = {
  firstName: string
  lastName: string
  phoneE164: string
  agreedToTerms: boolean
}

export type VerifyPhoneOtpInput = {
  registrationId: string
  code: string
}

export type ResendOtpResult = {
  nextResendInSeconds: number
}

export type StartGoogleAuthOptions = {
  registrationId?: string
}

export type GoogleAuthenticationResult = {
  /** Backend-issued session reference. Never contains raw Cognito tokens for mock. */
  sessionRef: string
  email: string
  emailVerified: boolean
}

export type ActivateAccountInput = {
  registrationId: string
  sessionRef: string
}

export type AuthService = {
  startRegistration(input: StartRegistrationInput): Promise<PendingRegistration>
  sendPhoneOtp(registrationId: string): Promise<ResendOtpResult>
  verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<PendingRegistration>
  resendPhoneOtp(registrationId: string): Promise<ResendOtpResult>
  startGoogleAuthentication(opts: StartGoogleAuthOptions): Promise<{ redirectUrl: string }>
  completeGoogleAuthentication(callbackParams: Record<string, string>): Promise<GoogleAuthenticationResult>
  activateStudentAccount(input: ActivateAccountInput): Promise<AuthenticatedUser>
  getCurrentUser(): Promise<AuthenticatedUser | null>
  logout(): Promise<void>
}

export class AuthServiceError extends Error {
  code:
    | 'INVALID_OTP'
    | 'EXPIRED_OTP'
    | 'TOO_MANY_ATTEMPTS'
    | 'RESEND_THROTTLED'
    | 'REGISTRATION_NOT_FOUND'
    | 'REGISTRATION_EXPIRED'
    | 'PHONE_NOT_VERIFIED'
    | 'GOOGLE_CANCELLED'
    | 'GOOGLE_EMAIL_UNVERIFIED'
    | 'ACCOUNT_CONFLICT'
    | 'NETWORK'
    | 'UNKNOWN'

  constructor(code: AuthServiceError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'AuthServiceError'
  }
}
