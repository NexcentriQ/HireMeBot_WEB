import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../AuthProvider'
import { AuthServiceError, type SignInFlow } from '../types'
import type { AccountState } from '../account'

export type GoogleSignInStartResult =
  | { status: 'redirecting' }
  /** A Cognito session already existed; `account` is the fresh `GET /auth/me` answer. */
  | { status: 'already-signed-in'; account: AccountState }
  | { status: 'error'; error: AuthServiceError }

/**
 * Drives an existing "Continue with Google" button.
 *
 * - Ignores repeat clicks while a redirect is starting (no overlapping OAuth
 *   attempts — each would overwrite the PKCE verifier of the previous one).
 * - Keeps the button busy after a successful start because the page is about
 *   to navigate to Cognito, and resets it if the browser restores the page
 *   from the back/forward cache (user pressed Back on Google).
 */
export function useGoogleSignIn(flow: SignInFlow) {
  const { loginWithGoogle, refresh } = useAuth()
  const [redirecting, setRedirecting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        inFlight.current = false
        setRedirecting(false)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const start = useCallback(
    async (returnTo?: string | null): Promise<GoogleSignInStartResult | null> => {
      if (inFlight.current) return null
      inFlight.current = true
      setRedirecting(true)
      try {
        await loginWithGoogle({ flow, returnTo })
        return { status: 'redirecting' }
      } catch (err) {
        inFlight.current = false
        setRedirecting(false)
        const error = err instanceof AuthServiceError ? err : new AuthServiceError('UNKNOWN', 'Google sign-in could not start.')
        if (error.code === 'ALREADY_SIGNED_IN') {
          const snapshot = await refresh()
          if (snapshot.user) return { status: 'already-signed-in', account: snapshot.account }
        }
        return { status: 'error', error }
      }
    },
    [flow, loginWithGoogle, refresh]
  )

  return { start, redirecting }
}
