import {
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
  signOut,
  type AuthSession
} from 'aws-amplify/auth'
import { cognitoEnv, missingCognitoEnv } from '@/lib/env'
import { AuthServiceError, type AuthUser } from '../types'
import {
  AUTH_MESSAGES,
  notConfiguredError,
  oauthCallbackError,
  redirectMismatchError,
  toAuthServiceError
} from './authErrors'
import { waitForRedirectOutcome } from './redirectOutcome'

/**
 * Centralized Amazon Cognito authentication (AWS Amplify v6).
 *
 * - Google sign-in uses Cognito's OAuth 2.0 Authorization Code flow with PKCE.
 *   The browser never sees the Google client secret; Cognito brokers Google.
 * - Amplify owns token storage and refresh (configured in amplifyConfig.ts).
 *   Nothing here copies JWTs into app state, Web Storage, or logs.
 * - Token claims are read from Amplify's decoded ID token for display and
 *   routing only. They are NOT a security boundary: the backend must verify
 *   the JWT signature and enforce authorization.
 */

function assertConfigured(): void {
  const missing = missingCognitoEnv()
  if (missing.length > 0) throw notConfiguredError(missing)
}

/**
 * Amplify falls back to a hostname-only match when choosing the redirect URL
 * (it ignores the port), so `localhost:4173` would silently send the user to
 * the `localhost:5173` callback and lose the PKCE verifier. Fail fast with an
 * actionable message instead.
 */
function assertRedirectOriginMatches(): void {
  const { redirectSignIn } = cognitoEnv()
  const here = window.location.origin
  const matches = redirectSignIn.some((url) => {
    try {
      return new URL(url).origin === here
    } catch {
      return false
    }
  })
  if (!matches) throw redirectMismatchError(redirectSignIn, here)
}

/** Starts Google sign-in. On success the browser navigates away to Cognito. */
export async function loginWithGoogle(): Promise<void> {
  assertConfigured()
  assertRedirectOriginMatches()
  try {
    await signInWithRedirect({ provider: 'Google' })
  } catch (err) {
    throw toAuthServiceError(err)
  }
}

/** Current Amplify session; Amplify refreshes expired tokens transparently. */
export async function getAuthSession(options?: { forceRefresh?: boolean }): Promise<AuthSession> {
  assertConfigured()
  try {
    return await fetchAuthSession(options)
  } catch (err) {
    throw toAuthServiceError(err)
  }
}

/**
 * Access token for calling a Cognito-protected API (e.g. an API Gateway
 * Cognito authorizer). Returns `null` when signed out. Do not log or persist.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getAuthSession()
  return session.tokens?.accessToken?.toString() ?? null
}

/** ID token (identity claims). Returns `null` when signed out. Do not log or persist. */
export async function getIdToken(): Promise<string | null> {
  const session = await getAuthSession()
  return session.tokens?.idToken?.toString() ?? null
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getAuthenticatedUser()) !== null
}

/**
 * The signed-in user, or `null` when there is no valid session.
 *
 * If an OAuth redirect is still being exchanged, Amplify parks this call until
 * the exchange settles, so it is safe to call from /auth/callback on mount.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  if (missingCognitoEnv().length > 0) return null
  try {
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken
    const accessToken = session.tokens?.accessToken
    // A session without both tokens is not an authenticated session.
    if (!idToken || !accessToken) return null
    const { userId, username } = await getCurrentUser()
    return toAuthUser(userId, username, idToken.payload)
  } catch (err) {
    const mapped = toAuthServiceError(err)
    if (mapped.code === 'SESSION_UNAVAILABLE') return null
    throw mapped
  }
}

/**
 * Signs out of Cognito. Amplify clears its stored tokens, revokes the refresh
 * token, then redirects the browser to the Cognito `/logout` endpoint, which
 * returns to VITE_COGNITO_SIGNOUT_URL.
 */
export async function logout(): Promise<void> {
  if (missingCognitoEnv().length > 0) return
  try {
    await signOut()
  } catch (err) {
    throw toAuthServiceError(err)
  }
}

/** How long /auth/callback waits for Amplify's Hub outcome before giving up. */
export const REDIRECT_COMPLETION_TIMEOUT_MS = 15_000

/**
 * Resolves the browser's return from Cognito into a signed-in user.
 *
 * Handles every ordering of "Amplify finished the code exchange" vs. "the
 * callback page mounted": an already-established session, an exchange still
 * in flight (Amplify parks `getAuthenticatedUser`), and a Hub outcome that
 * arrives slightly after the parked call is released.
 */
export async function completeRedirectSignIn(
  options: { search?: string; timeoutMs?: number } = {}
): Promise<AuthUser> {
  const params = new URLSearchParams(options.search ?? window.location.search)

  // Cognito reports IdP errors (user cancelled, account rejected, …) on the
  // callback URL. Amplify does not clear these params on failure.
  const oauthError = params.get('error')
  if (oauthError) throw oauthCallbackError(oauthError, params.get('error_description'))

  const user = await getAuthenticatedUser()
  if (user) return user

  if (params.has('code')) {
    // The parked call can be released a moment before Amplify dispatches its
    // Hub outcome. Wait for it instead of reporting a premature failure.
    const outcome = await waitForRedirectOutcome(options.timeoutMs ?? REDIRECT_COMPLETION_TIMEOUT_MS)
    if (outcome.type === 'failure') throw toAuthServiceError(outcome.error)
    if (outcome.type === 'success') {
      const settled = await getAuthenticatedUser()
      if (settled) return settled
    }
  }

  throw new AuthServiceError('SESSION_UNAVAILABLE', AUTH_MESSAGES.sessionUnavailable)
}

// ---------------------------------------------------------------------------
// Claim mapping
// ---------------------------------------------------------------------------

type Claims = Record<string, unknown>

function claimString(claims: Claims, key: string): string | null {
  const value = claims[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function claimBoolean(claims: Claims, key: string): boolean | null {
  const value = claims[key]
  if (typeof value === 'boolean') return value
  // Federated users can receive string booleans from attribute mapping.
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function providerFromIdentities(claims: Claims): string | null {
  let identities = claims.identities
  if (typeof identities === 'string') {
    try {
      identities = JSON.parse(identities)
    } catch {
      return null
    }
  }
  if (!Array.isArray(identities) || identities.length === 0) return null
  const first = identities[0] as { providerName?: unknown }
  return typeof first?.providerName === 'string' ? first.providerName : null
}

export function toAuthUser(userId: string, username: string, claims: Claims): AuthUser {
  return {
    userId,
    username,
    email: claimString(claims, 'email'),
    emailVerified: claimBoolean(claims, 'email_verified'),
    givenName: claimString(claims, 'given_name'),
    familyName: claimString(claims, 'family_name'),
    identityProvider: providerFromIdentities(claims)
  }
}
