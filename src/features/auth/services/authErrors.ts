import { AuthServiceError } from '../types'

/**
 * Translates Amplify / OAuth / network failures into user-safe
 * `AuthServiceError`s. Raw SDK messages are only surfaced in development
 * builds (as a parenthetical) to make misconfiguration actionable; they never
 * contain tokens, but production users don't need internal detail.
 */

const isDev = () => import.meta.env.DEV

function devDetail(detail: string | null | undefined): string {
  return isDev() && detail ? ` (${detail})` : ''
}

function errorName(err: unknown): string {
  return err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''
}

function errorMessage(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
}

const CANCEL_PATTERN = /cancel|access_denied/i
const NETWORK_PATTERN = /network|failed to fetch|load failed|networkerror/i

export const AUTH_MESSAGES = {
  cancelled: 'Google sign-in was cancelled. You can try again when you’re ready.',
  googleFailed:
    'Google sign-in didn’t complete. Please try again. If this keeps happening, your Google account may not be allowed to use HireMeBot yet.',
  network: 'We couldn’t reach the sign-in service. Check your connection and try again.',
  notConfigured: 'Sign-in isn’t available right now. Please try again later.',
  redirectMismatch: 'Sign-in isn’t configured for this web address.',
  sessionUnavailable: 'We couldn’t complete your sign-in. Please try again.',
  unknown: 'Something went wrong while signing in. Please try again.'
} as const

export function notConfiguredError(missing: string[]): AuthServiceError {
  return new AuthServiceError(
    'NOT_CONFIGURED',
    AUTH_MESSAGES.notConfigured + devDetail(missing.length ? `missing ${missing.join(', ')} — see .env.example` : null)
  )
}

export function redirectMismatchError(expected: string[], actualOrigin: string): AuthServiceError {
  return new AuthServiceError(
    'REDIRECT_MISMATCH',
    AUTH_MESSAGES.redirectMismatch +
      devDetail(
        `app is running on ${actualOrigin} but VITE_COGNITO_REDIRECT_URL is ${expected.join(', ')}. ` +
          'Use a matching origin, or add this callback URL to VITE_COGNITO_REDIRECT_URL and to the Cognito app client allowed callback URLs'
      )
  )
}

/**
 * Error returned to the callback URL by Cognito (`?error=…&error_description=…`),
 * e.g. when the user cancels at Google or the IdP rejects the account.
 */
export function oauthCallbackError(error: string, description: string | null): AuthServiceError {
  const detail = description ? `${error}: ${description}` : error
  if (CANCEL_PATTERN.test(error) || CANCEL_PATTERN.test(description ?? '')) {
    return new AuthServiceError('GOOGLE_CANCELLED', AUTH_MESSAGES.cancelled)
  }
  return new AuthServiceError('GOOGLE_SIGN_IN_FAILED', AUTH_MESSAGES.googleFailed + devDetail(detail))
}

export function toAuthServiceError(err: unknown): AuthServiceError {
  if (err instanceof AuthServiceError) return err

  const name = errorName(err)
  const message = errorMessage(err)

  switch (name) {
    case 'UserAlreadyAuthenticatedException':
      return new AuthServiceError('ALREADY_SIGNED_IN', 'You’re already signed in.')
    case 'InvalidRedirectException':
    case 'InvalidOriginException':
    case 'InvalidPreferredRedirectUrlException':
      return new AuthServiceError('REDIRECT_MISMATCH', AUTH_MESSAGES.redirectMismatch + devDetail(message))
    case 'UserUnAuthenticatedException':
      return new AuthServiceError('SESSION_UNAVAILABLE', AUTH_MESSAGES.sessionUnavailable)
    case 'AuthUserPoolException':
    case 'AuthUserPoolAndIdentityPoolException':
    case 'OAuthNotConfigureException':
    case 'AuthTokenConfigException':
      return new AuthServiceError('NOT_CONFIGURED', AUTH_MESSAGES.notConfigured + devDetail(message))
    case 'OAuthSignInException':
    case 'OAuthSignInError':
      if (CANCEL_PATTERN.test(message)) return new AuthServiceError('GOOGLE_CANCELLED', AUTH_MESSAGES.cancelled)
      if (NETWORK_PATTERN.test(message)) return new AuthServiceError('NETWORK', AUTH_MESSAGES.network)
      return new AuthServiceError('GOOGLE_SIGN_IN_FAILED', AUTH_MESSAGES.googleFailed + devDetail(message))
    case 'NetworkError':
      return new AuthServiceError('NETWORK', AUTH_MESSAGES.network)
    default:
      if (NETWORK_PATTERN.test(name) || (err instanceof TypeError && NETWORK_PATTERN.test(message))) {
        return new AuthServiceError('NETWORK', AUTH_MESSAGES.network)
      }
      return new AuthServiceError('UNKNOWN', AUTH_MESSAGES.unknown + devDetail(name || null))
  }
}

/**
 * Development-only diagnostic. Logs the error *name* and context, never the
 * error object itself (which could carry request/response payloads).
 */
export function logAuthIssue(context: string, err: unknown): void {
  if (!isDev()) return
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${context}: ${errorName(err) || 'Error'}`)
}
