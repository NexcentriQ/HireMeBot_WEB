import { useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { useGoogleSignIn } from '@/features/auth/hooks/useGoogleSignIn'
import { isSafeReturnPath } from '@/features/auth/services/redirectIntent'
import { routeForAccount } from '@/features/auth/account'
import { useToast } from '@/components/common/ToastProvider'

/**
 * One button serves new and returning students: after Google, the backend
 * (`GET /auth/me`) decides between the dashboard and the signup form. The
 * "Sign Up" link therefore starts the same Google flow.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const { start, redirecting } = useGoogleSignIn('login')
  const signup = useGoogleSignIn('signup')
  const busy = redirecting || signup.redirecting
  // Set by RequireStudent when an unauthenticated user opened a protected page.
  const from = (location.state as { from?: unknown } | null)?.from
  const returnTo = isSafeReturnPath(from) ? from : null

  async function handleGoogle(which: 'login' | 'signup') {
    if (busy) return
    // Real Google sign-in through Amazon Cognito. The browser leaves for
    // Cognito → Google and comes back to /auth/callback.
    const result = which === 'login' ? await start(returnTo) : await signup.start()
    if (!result) return // a redirect is already starting
    if (result.status === 'already-signed-in') {
      navigate(routeForAccount(result.account, returnTo), { replace: true })
    } else if (result.status === 'error') {
      toast.show(result.error.message, 'error')
    }
  }

  return (
    <AuthLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <Logo size={72} />
        <p className="mt-6 text-base text-muted-foreground max-w-xs">
          Track your job applications towards a brighter future
        </p>

        <div className="w-full mt-10 space-y-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full justify-center bg-card"
            onClick={() => handleGoogle('login')}
            loading={redirecting}
            disabled={signup.redirecting}
          >
            <GoogleIcon />
            <span className="font-semibold">Continue with Google</span>
          </Button>
          <p className="text-sm text-muted-foreground">
            Don’t have an account?{' '}
            <button
              type="button"
              onClick={() => handleGoogle('signup')}
              disabled={busy}
              className="text-primary font-semibold hover:underline disabled:opacity-60"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>

      <p className="relative z-10 mt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our{' '}
        <a href="#" className="underline">Terms of Service</a> and{' '}
        <a href="#" className="underline">Privacy Policy</a>.
      </p>
    </AuthLayout>
  )
}
