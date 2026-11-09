import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LogoMark } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { GraduateIllustration } from '@/components/common/GraduateIllustration'
import { readOnboardingDraft } from '../services/onboardingDraft'
import { useGoogleSignIn } from '../hooks/useGoogleSignIn'
import { useToast } from '@/components/common/ToastProvider'
import { routeForAccount } from '../account'

/**
 * Shown when the session ended in the middle of signup (refresh token
 * expired/revoked, or the API answered 401). The signup draft is kept in
 * sessionStorage; after Continue with Google the callback re-runs
 * `GET /auth/me` and, on SIGNUP_FORM, restores the draft for the same
 * identity (STUDENT_AUTH_API.md §7).
 */
export function ConnectGooglePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { start, redirecting } = useGoogleSignIn('signup')
  const [draft] = useState(() => readOnboardingDraft())

  if (!draft) return null

  async function handleContinue() {
    // Real Google sign-in through Amazon Cognito (OAuth code + PKCE). The
    // browser leaves for Cognito → Google and returns to /auth/callback.
    const result = await start()
    if (!result) return // a redirect is already starting
    if (result.status === 'already-signed-in') {
      navigate(routeForAccount(result.account), { replace: true })
    } else if (result.status === 'error') {
      toast.show(result.error.message, 'error')
    }
  }

  return (
    <AuthLayout
      topBar={
        <Link
          to="/login"
          aria-label="Back"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
    >
      <div className="flex-1 flex flex-col items-center text-center animate-fade-in">
        <LogoMark size={56} className="mt-4" />
        <h1 className="mt-4 text-2xl font-bold">Continue with Google</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Your session ended. Sign in with the same Google account to finish your registration — your
          details are saved.
        </p>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full mt-8 bg-card"
          loading={redirecting}
          onClick={handleContinue}
        >
          <GoogleIcon />
          <span className="font-semibold">Continue with Google</span>
        </Button>

        <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground max-w-xs">
          <ShieldCheck className="h-4 w-4 mt-0.5" aria-hidden="true" />
          <p>Your email will be verified and linked to your HireMeBot account.</p>
        </div>

        <div className="mt-10 w-56 max-w-full">
          <GraduateIllustration className="w-full h-auto" />
        </div>
      </div>
    </AuthLayout>
  )
}
