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
 * SCAFFOLD ONLY. This class documents the integration boundary between the
 * frontend and the eventual Amazon Cognito User Pool + backend APIs.
 *
 * To activate:
 *   1. Deploy the Cognito User Pool with Google federation.
 *   2. Expose the registration & activation endpoints (see docs/BACKEND.md).
 *   3. Provide the required VITE_* environment variables.
 *   4. Replace the mockAuthService export in src/features/auth/AuthProvider.tsx
 *      with an instance of CognitoAuthService.
 *
 * The browser never holds a Cognito client secret. OAuth uses Authorization
 * Code + PKCE and the backend performs the token exchange so that long-lived
 * credentials stay out of JavaScript.
 */
export type CognitoAuthConfig = {
  region: string
  userPoolId: string
  appClientId: string
  cognitoDomain: string
  redirectUri: string
  logoutUri: string
  apiBaseUrl: string
}

export class CognitoAuthService implements AuthService {
  // Config will be referenced by each endpoint implementation once wired up.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: CognitoAuthConfig) {}

  private notConfigured(method: string): never {
    throw new AuthServiceError(
      'UNKNOWN',
      `CognitoAuthService.${method} is not implemented. See docs/BACKEND.md for required endpoints and configuration.`
    )
  }

  async startRegistration(_input: StartRegistrationInput): Promise<PendingRegistration> {
    this.notConfigured('startRegistration')
  }

  async sendPhoneOtp(_registrationId: string): Promise<ResendOtpResult> {
    this.notConfigured('sendPhoneOtp')
  }

  async verifyPhoneOtp(_input: VerifyPhoneOtpInput): Promise<PendingRegistration> {
    this.notConfigured('verifyPhoneOtp')
  }

  async resendPhoneOtp(_registrationId: string): Promise<ResendOtpResult> {
    this.notConfigured('resendPhoneOtp')
  }

  async startGoogleAuthentication(_opts: StartGoogleAuthOptions): Promise<{ redirectUrl: string }> {
    // The real implementation builds an authorize URL for the Cognito hosted
    // UI, generates/stores a PKCE verifier, and includes the Google provider
    // hint. The backend session binds the pending registration to the
    // callback via a server-side nonce so a URL cannot be tampered with.
    this.notConfigured('startGoogleAuthentication')
  }

  async completeGoogleAuthentication(_callbackParams: Record<string, string>): Promise<GoogleAuthenticationResult> {
    this.notConfigured('completeGoogleAuthentication')
  }

  async activateStudentAccount(_input: ActivateAccountInput): Promise<AuthenticatedUser> {
    this.notConfigured('activateStudentAccount')
  }

  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    return null
  }

  async logout(): Promise<void> {
    // Clear local session; backend session cookie must also be cleared via a
    // POST to the logout endpoint and the user redirected to the Cognito
    // logout URL.
  }
}
