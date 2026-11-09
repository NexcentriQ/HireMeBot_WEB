import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { readOnboardingDraft } from '@/features/auth/services/onboardingDraft'
import { LOGIN_PATH, SIGNUP_PATH, routeForAccount, type AccountStatus } from '@/features/auth/account'

/**
 * Route guards.
 *
 * Authorization is driven by the backend account state (`GET /auth/me`), not
 * by the mere presence of a Cognito session: a Google user that is not a
 * registered, active student never reaches `/student/*`. Every student API
 * must still enforce this server-side; these guards are UX, not security.
 */

const RECONNECT_PATH = '/connect-google'

/** Signed out: resume an interrupted signup if its draft is still here, else log in. */
function signedOutTarget(): string {
  return readOnboardingDraft() ? RECONNECT_PATH : LOGIN_PATH
}

function RequireAccount({
  allow,
  children,
  rememberDestination = false
}: {
  allow: readonly AccountStatus[]
  children: React.ReactNode
  rememberDestination?: boolean
}) {
  const { isAuthenticated, isLoading, account } = useAuth()
  const location = useLocation()
  if (isLoading) return <SplashScreen />
  if (!isAuthenticated) {
    if (rememberDestination) {
      return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname + location.search }} />
    }
    return <Navigate to={signedOutTarget()} replace />
  }
  if (!allow.includes(account.status)) return <Navigate to={routeForAccount(account)} replace />
  return <>{children}</>
}

/** `/student/*`: registered, ACTIVE students only (`nextStep: DASHBOARD`). */
export function RequireStudent({ children }: { children: React.ReactNode }) {
  return (
    <RequireAccount allow={['active']} rememberDestination>
      {children}
    </RequireAccount>
  )
}

/** Signup form: a Google identity the backend answered `SIGNUP_FORM` for. */
export function RequireSignupForm({ children }: { children: React.ReactNode }) {
  return <RequireAccount allow={['unregistered']}>{children}</RequireAccount>
}

/** OTP + registration step: `SIGNUP_FORM` and a signup draft written by this identity. */
export function RequirePendingRegistration({ children }: { children: React.ReactNode }) {
  return (
    <RequireAccount allow={['unregistered']}>
      <RequireOwnDraft>{children}</RequireOwnDraft>
    </RequireAccount>
  )
}

function RequireOwnDraft({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!readOnboardingDraft(user?.userId)) return <Navigate to={SIGNUP_PATH} replace />
  return <>{children}</>
}

/** Pending, restricted, and "couldn't load your account" screens. */
export function RequireAccountStatus({ children }: { children: React.ReactNode }) {
  return <RequireAccount allow={['pending', 'restricted', 'error']}>{children}</RequireAccount>
}

/** Login: signed-out users only. Signed-in users go wherever their account belongs. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, account } = useAuth()
  if (isLoading) return <SplashScreen />
  if (isAuthenticated) return <Navigate to={routeForAccount(account)} replace />
  return <>{children}</>
}

/**
 * "Continue with Google to finish signing up": the session ended mid-signup
 * and the draft is kept (contract §7). Signed-in users are routed by account.
 */
export function RequireInterruptedSignup({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, account } = useAuth()
  if (isLoading) return <SplashScreen />
  if (isAuthenticated) return <Navigate to={routeForAccount(account)} replace />
  if (!readOnboardingDraft()) return <Navigate to={LOGIN_PATH} replace />
  return <>{children}</>
}

/** `/`: send everyone to the right starting point. */
export function RootRedirect() {
  const { isAuthenticated, isLoading, account } = useAuth()
  if (isLoading) return <SplashScreen />
  return <Navigate to={isAuthenticated ? routeForAccount(account) : signedOutTarget()} replace />
}

export function SplashScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
      <div
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-r-transparent"
      />
    </div>
  )
}
