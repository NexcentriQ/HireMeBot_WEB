import { Amplify, type ResourcesConfig } from 'aws-amplify'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito'
import { sessionStorage } from 'aws-amplify/utils'
// Completes the OAuth code exchange when the app loads on the callback URL.
import 'aws-amplify/auth/enable-oauth-listener'
import { cognitoEnv, missingCognitoEnv, type CognitoEnv } from '@/lib/env'
import { startRedirectOutcomeRecorder } from './services/redirectOutcome'
import { purgeLegacyMockAuthStorage } from './services/onboardingDraft'

/** Must match the scopes allowed on the Cognito app client. */
export const COGNITO_OAUTH_SCOPES = ['openid', 'email']

/** Pure builder for the Amplify v6 `ResourcesConfig` (unit-tested). */
export function buildAmplifyConfig(env: CognitoEnv): ResourcesConfig {
  return {
    Auth: {
      Cognito: {
        userPoolId: env.userPoolId ?? '',
        userPoolClientId: env.clientId ?? '',
        loginWith: {
          oauth: {
            domain: env.domain ?? '',
            scopes: [...COGNITO_OAUTH_SCOPES],
            redirectSignIn: env.redirectSignIn,
            redirectSignOut: env.redirectSignOut,
            responseType: 'code',
            providers: ['Google']
          }
        }
      }
    }
  }
}

export type AuthInitResult = { configured: true } | { configured: false; missing: string[] }

let initResult: AuthInitResult | null = null

/**
 * Configures Amplify exactly once, before React renders.
 *
 * Token storage: Amplify's supported `sessionStorage` adapter. Sessions
 * survive page refreshes but end when the tab/app window closes. This
 * follows the project rule against persisting JWTs in localStorage (see
 * docs/BACKEND.md). To keep users signed in across browser restarts, remove
 * the `setKeyValueStorage` line; Amplify then uses localStorage. Moving to
 * HttpOnly cookies requires a backend-for-frontend.
 */
export function initializeAuth(): AuthInitResult {
  if (initResult) return initResult

  purgeLegacyMockAuthStorage()

  const env = cognitoEnv()
  const missing = missingCognitoEnv(env)
  if (missing.length > 0) {
    if (import.meta.env.DEV) {
      // Names only — never values.
      // eslint-disable-next-line no-console
      console.error(`[auth] Cognito is not configured. Missing/invalid: ${missing.join(', ')}. See .env.example.`)
    }
    initResult = { configured: false, missing }
    return initResult
  }

  // Start recording OAuth Hub outcomes before configure() kicks off the
  // code exchange, so the callback page can't miss an early event.
  startRedirectOutcomeRecorder()

  const config = buildAmplifyConfig(env)
  cognitoUserPoolsTokenProvider.setAuthConfig(config.Auth!)
  cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage)
  // Passing our token provider explicitly stops configure() from resetting
  // storage to localStorage before the OAuth listener caches the new tokens.
  Amplify.configure(config, { Auth: { tokenProvider: cognitoUserPoolsTokenProvider } })

  initResult = { configured: true }
  return initResult
}
