import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Hub } from 'aws-amplify/utils'
import * as authService from './services/authService'
import * as accountApi from './services/studentAccountApi'
import { AccountApiError, type StudentRegistrationInput } from './services/studentAccountApi'
import { logAuthIssue, toAuthServiceError } from './services/authErrors'
import { clearRedirectIntent, saveRedirectIntent } from './services/redirectIntent'
import { clearOnboardingDraft } from './services/onboardingDraft'
import {
  NO_ACCOUNT,
  accountFromError,
  accountFromLookup,
  accountFromRegistration,
  type AccountState
} from './account'
import type { AuthServiceError, AuthUser, SignInFlow } from './types'

export type SessionSnapshot = { user: AuthUser | null; account: AccountState }

type AuthContextValue = {
  /** Cognito identity (display/routing only; never an authorization decision). */
  user: AuthUser | null
  isAuthenticated: boolean
  /** Backend account state from `GET /api/v1/auth/me`. `none` when signed out. */
  account: AccountState
  /** True until the initial session check AND account lookup finish. Guards wait on it. */
  isLoading: boolean
  /** Last session-check failure (network, misconfiguration). Never contains tokens. */
  error: AuthServiceError | null
  /** Redirects to Google via Cognito. Rejects with `AuthServiceError` if it can't start. */
  loginWithGoogle: (options: { flow: SignInFlow; returnTo?: string | null }) => Promise<void>
  /** Full sign-out: clears the signup draft and redirect intent, then Cognito /logout. */
  logout: () => Promise<void>
  /** Re-reads the Cognito session and re-runs `GET /auth/me`. */
  refresh: (options?: { background?: boolean }) => Promise<SessionSnapshot>
  /**
   * `POST /api/v1/students/register` for the signed-in identity. Resolves with
   * the resulting account state (navigate with `routeForAccount`). Rejects with
   * `AccountApiError` for VALIDATION_FAILED, NAME_ALREADY_REGISTERED, retryable
   * failures and UNAUTHORIZED (after the session has been ended, draft kept).
   * Concurrent calls share one request.
   */
  registerStudent: (input: StudentRegistrationInput) => Promise<AccountState>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SIGNED_OUT: SessionSnapshot = { user: null, account: NO_ACCOUNT }

/**
 * Application auth state.
 *
 * - Amplify (Cognito) is the source of truth for the *session*. This provider
 *   mirrors the identity (no tokens) into React state.
 * - The backend is the source of truth for the *account*. It is asked on
 *   every app start and every Google sign-in, and the answer lives only in
 *   memory, so suspensions take effect on the next lookup.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [account, setAccount] = useState<AccountState>(NO_ACCOUNT)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AuthServiceError | null>(null)
  const queryClient = useQueryClient()

  // Drops results from stale overlapping checks (StrictMode, Hub + focus, logout).
  const checkSeq = useRef(0)
  const refreshInFlight = useRef<Promise<SessionSnapshot> | null>(null)
  const registerInFlight = useRef<Promise<AccountState> | null>(null)
  const userRef = useRef<AuthUser | null>(null)
  const accountRef = useRef<AccountState>(NO_ACCOUNT)
  userRef.current = user
  accountRef.current = account

  const dropStudentCache = useCallback(() => {
    // A different (or no) identity must never read a prior student's cache.
    queryClient.removeQueries({ queryKey: ['student-dashboard'] })
  }, [queryClient])

  const clearSessionState = useCallback(() => {
    checkSeq.current++
    refreshInFlight.current = null
    setUser(null)
    setAccount(NO_ACCOUNT)
    dropStudentCache()
  }, [dropStudentCache])

  /**
   * The backend rejected the session (401), or Amplify has no access token.
   * Contract §3/§7: sign out locally, keep the signup draft, and send the
   * user to Continue with Google.
   */
  const endRejectedSession = useCallback(
    async (err: AccountApiError) => {
      clearRedirectIntent()
      clearSessionState()
      if (err.code === 'NO_SESSION') return // Amplify already holds no tokens.
      try {
        // Clears Amplify's tokens so Continue with Google can start again.
        await authService.logout()
      } catch (logoutErr) {
        logAuthIssue('sign-out after 401 failed', logoutErr)
      }
    },
    [clearSessionState]
  )

  const refresh = useCallback(
    (options: { background?: boolean } = {}): Promise<SessionSnapshot> => {
      if (refreshInFlight.current) return refreshInFlight.current
      const seq = ++checkSeq.current
      const isCurrent = () => seq === checkSeq.current

      const run = async (): Promise<SessionSnapshot> => {
        let nextUser: AuthUser | null
        try {
          nextUser = await authService.getAuthenticatedUser()
        } catch (err) {
          logAuthIssue('session check failed', err)
          // A session we can't confirm is treated as signed out.
          if (isCurrent()) {
            setUser(null)
            setAccount(NO_ACCOUNT)
            setError(toAuthServiceError(err))
            dropStudentCache()
          }
          return SIGNED_OUT
        }

        if (!nextUser) {
          if (isCurrent()) {
            if (userRef.current) dropStudentCache()
            setUser(null)
            setAccount(NO_ACCOUNT)
            setError(null)
          }
          return SIGNED_OUT
        }

        let nextAccount: AccountState
        try {
          nextAccount = accountFromLookup(await accountApi.lookupAccount())
        } catch (err) {
          const apiErr =
            err instanceof AccountApiError ? err : new AccountApiError({ status: 0, code: 'INVALID_RESPONSE' })
          logAuthIssue('account lookup failed', err)
          if (apiErr.isUnauthorized) {
            if (isCurrent()) await endRejectedSession(apiErr)
            return SIGNED_OUT
          }
          nextAccount = accountFromError(apiErr)
          // A background re-check that hits a transient failure keeps the last
          // known state for the same identity instead of kicking the user out.
          const previous = accountRef.current
          if (
            options.background &&
            nextAccount.status === 'error' &&
            userRef.current?.userId === nextUser.userId &&
            previous.status !== 'none'
          ) {
            nextAccount = previous
          }
        }

        if (isCurrent()) {
          if (userRef.current && userRef.current.userId !== nextUser.userId) dropStudentCache()
          setUser(nextUser)
          setAccount(nextAccount)
          setError(null)
        }
        return { user: nextUser, account: nextAccount }
      }

      const promise = run().finally(() => {
        if (refreshInFlight.current === promise) refreshInFlight.current = null
      })
      refreshInFlight.current = promise
      return promise
    },
    [dropStudentCache, endRejectedSession]
  )

  const registerStudent = useCallback(
    (input: StudentRegistrationInput): Promise<AccountState> => {
      if (registerInFlight.current) return registerInFlight.current

      const run = async (): Promise<AccountState> => {
        try {
          const next = accountFromRegistration(await accountApi.registerStudent(input))
          clearOnboardingDraft()
          setAccount(next)
          return next
        } catch (err) {
          if (!(err instanceof AccountApiError)) throw err
          if (err.code === 'ACCOUNT_ALREADY_REGISTERED') {
            // Double submit or a lost 201: ask the backend and follow it.
            clearOnboardingDraft()
            return (await refresh()).account
          }
          if (err.isUnauthorized) {
            await endRejectedSession(err) // draft intentionally kept
            throw err
          }
          if (err.isRestriction) {
            clearOnboardingDraft()
            const restricted = accountFromError(err)
            setAccount(restricted)
            return restricted
          }
          throw err
        }
      }

      const promise = run().finally(() => {
        if (registerInFlight.current === promise) registerInFlight.current = null
      })
      registerInFlight.current = promise
      return promise
    },
    [refresh, endRejectedSession]
  )

  const logout = useCallback(async () => {
    clearOnboardingDraft()
    clearRedirectIntent()
    clearSessionState()
    try {
      // Navigates to Cognito /logout, which returns to VITE_COGNITO_SIGNOUT_URL.
      await authService.logout()
    } catch (err) {
      logAuthIssue('sign-out failed', err)
      setError(toAuthServiceError(err))
    }
  }, [clearSessionState])

  const loginWithGoogle = useCallback(
    async ({ flow, returnTo }: { flow: SignInFlow; returnTo?: string | null }) => {
      saveRedirectIntent(flow, returnTo)
      try {
        await authService.loginWithGoogle()
      } catch (err) {
        const mapped = toAuthServiceError(err)
        // Keep the intent when already signed in: the caller resumes from it.
        if (mapped.code !== 'ALREADY_SIGNED_IN') clearRedirectIntent()
        throw mapped
      }
    },
    []
  )

  // App start (and full page refresh): restore the session, then ask the backend.
  useEffect(() => {
    let active = true
    void refresh().finally(() => {
      if (active) setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [refresh])

  // Keep context in sync with Amplify's own auth lifecycle.
  useEffect(() => {
    return Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'signInWithRedirect':
          // Every Google sign-in re-runs GET /auth/me.
          void refresh()
          break
        case 'signedOut':
          clearSessionState()
          break
        case 'tokenRefresh_failure':
          // Expired/revoked refresh token: Amplify cleared the tokens. Re-check
          // so guards redirect to login instead of showing a dead session.
          void refresh()
          break
      }
    })
  }, [refresh, clearSessionState])

  // Notice expiry, suspension, or a changed identity when the user returns to the tab.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && userRef.current) void refresh({ background: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      account,
      isLoading,
      error,
      loginWithGoogle,
      logout,
      refresh,
      registerStudent
    }),
    [user, account, isLoading, error, loginWithGoogle, logout, refresh, registerStudent]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
