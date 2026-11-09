import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '../AuthProvider'
import { completeRedirectSignIn } from '../services/authService'
import { AUTH_MESSAGES, logAuthIssue, toAuthServiceError } from '../services/authErrors'
import { clearRedirectIntent, readRedirectIntent } from '../services/redirectIntent'
import { clearOnboardingDraft, readOnboardingDraft } from '../services/onboardingDraft'
import { routeForAccount } from '../account'
import { AuthServiceError } from '../types'

type Status = 'processing' | 'error'

/**
 * Landing page for Cognito's OAuth redirect (`/auth/callback`).
 *
 * Amplify performs the authorization-code + PKCE exchange on its own as soon
 * as it is configured; this page waits for that to settle (it never shows an
 * error while the exchange is still running), asks the backend who the user
 * is (`GET /api/v1/auth/me`, via `refresh()`), and navigates on `nextStep`:
 *
 *   DASHBOARD        → saved student page or the dashboard (draft cleared)
 *   SIGNUP_FORM      → signup form (draft kept only if this identity wrote it)
 *   ACCOUNT_PENDING  → account status screen (draft cleared)
 *   403 / 409 / 5xx  → account status screen (never the signup form)
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [status, setStatus] = useState<Status>('processing')
  const [message, setMessage] = useState('Finishing your sign-in…')
  // StrictMode mounts effects twice. `started` makes the work run once;
  // `mounted` (re-set on the second mount) lets that single run still
  // navigate, so there is exactly one redirect.
  const started = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const intent = readRedirectIntent()

    async function run() {
      try {
        await completeRedirectSignIn()
        // Syncs the session AND runs GET /auth/me before navigating, so the
        // guards see the account state the backend reported.
        const { user, account } = await refresh()
        if (!user) throw new AuthServiceError('SESSION_UNAVAILABLE', AUTH_MESSAGES.sessionUnavailable)
        clearRedirectIntent()

        if (account.status === 'unregistered') {
          // Restore an interrupted signup only for the identity that typed it.
          readOnboardingDraft(user.userId)
        } else if (account.status !== 'error') {
          clearOnboardingDraft()
        }
        if (mounted.current) navigate(routeForAccount(account, intent?.returnTo), { replace: true })
      } catch (err) {
        logAuthIssue('OAuth callback failed', err)
        clearRedirectIntent()
        if (!mounted.current) return
        setStatus('error')
        setMessage(toAuthServiceError(err).message)
      }
    }
    void run()
  }, [navigate, refresh])

  function tryAgain() {
    navigate(readOnboardingDraft() ? '/connect-google' : '/login', { replace: true })
  }

  return (
    <AuthLayout dark>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        {status === 'processing' ? (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin" aria-hidden="true" />
            <p className="mt-5 text-base text-muted-foreground" role="status">
              {message}
            </p>
          </>
        ) : (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Sign-in incomplete</h1>
            <p role="alert" className="mt-2 text-sm text-muted-foreground max-w-sm">
              {message}
            </p>
            <div className="mt-6 w-full flex flex-col gap-3">
              <Button size="lg" onClick={tryAgain}>
                Try again
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
