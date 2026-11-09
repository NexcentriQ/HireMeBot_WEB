import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { OtpInput } from '../components/OtpInput'
import { useResendCountdown } from '../hooks/useResendCountdown'
import { readOnboardingDraft, updateOnboardingPhoneStep, type OnboardingDraft } from '../services/onboardingDraft'
import { getPhoneVerificationService } from '../services/phoneVerification'
import { DEV_MOCK_OTP_CODE } from '../services/mockOtpService'
import { AccountApiError } from '../services/studentAccountApi'
import { useAuth } from '../AuthProvider'
import { routeForAccount } from '../account'
import type { SignupRouteState } from './SignupPage'
import { useToast } from '@/components/common/ToastProvider'
import { maskPhone } from '@/lib/utils'
import { AuthServiceError } from '../types'

type RegisterFailure = { message: string; requestId: string | null }

/**
 * Signup step 2: phone check, then registration.
 *
 * - Development: mock OTP (fixed code, verifies nothing).
 * - Production: no SMS provider yet, so the step is explained and skipped.
 *
 * Either way, finishing the step calls `POST /api/v1/students/register` in
 * the same session. The phone is stored by the backend as NOT verified; no
 * OTP value or "verified" flag is ever sent.
 */
export function VerifyPhonePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, registerStudent } = useAuth()
  const [phoneVerification] = useState(getPhoneVerificationService)
  const [draft, setDraft] = useState<OnboardingDraft | null>(() => readOnboardingDraft(user?.userId))
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerFailure, setRegisterFailure] = useState<RegisterFailure | null>(null)
  const registerStarted = useRef(false)
  const { remaining, start } = useResendCountdown(60)

  useEffect(() => {
    if (!draft) {
      navigate('/signup', { replace: true })
    }
  }, [draft, navigate])

  if (!draft) return null
  const phoneStepDone = draft.phoneStep !== 'pending'

  async function register(current: OnboardingDraft) {
    // One POST at a time: the button is disabled and repeat calls are ignored.
    if (registerStarted.current) return
    registerStarted.current = true
    setRegistering(true)
    setRegisterFailure(null)
    try {
      const account = await registerStudent({
        firstName: current.firstName,
        lastName: current.lastName,
        phoneNumber: current.phoneE164,
        acceptedTerms: true
      })
      navigate(routeForAccount(account), { replace: true })
    } catch (err) {
      registerStarted.current = false
      setRegistering(false)
      if (!(err instanceof AccountApiError)) {
        setRegisterFailure({ message: 'We couldn’t create your account. Please try again.', requestId: null })
        return
      }
      if (err.code === 'VALIDATION_FAILED' || err.code === 'NAME_ALREADY_REGISTERED') {
        // Back to the form with the backend's messages on the fields. Never auto-retried.
        const state: SignupRouteState = { registrationError: { message: err.message, fieldErrors: err.fieldErrors } }
        navigate('/signup', { replace: true, state })
        return
      }
      if (err.isUnauthorized) {
        // The session was ended (draft kept); the guards route to Continue with Google.
        return
      }
      setRegisterFailure({ message: err.message, requestId: err.requestId })
    }
  }

  async function verify(codeToSubmit: string) {
    if (submitting || registering) return
    setError(null)
    setSubmitting(true)
    try {
      await phoneVerification.verifyCode(draft!.phoneE164, codeToSubmit)
      // Records UI progress only. This is a development simulation and is
      // never treated, stored, or sent as a verified phone number.
      const next = updateOnboardingPhoneStep('dev-simulated', user?.userId)
      if (!next) {
        setDraft(null)
        return
      }
      setDraft(next)
      setSubmitting(false)
      await register(next)
    } catch (err) {
      if (err instanceof AuthServiceError) {
        setError(err.message)
      } else {
        setError('Could not verify the code. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (remaining > 0 || resending) return
    setResending(true)
    try {
      const { nextResendInSeconds } = await phoneVerification.resendCode(draft!.phoneE164)
      start(nextResendInSeconds)
      toast.show(import.meta.env.DEV ? 'New code ready (development mock — no SMS sent).' : 'A new code has been sent.', 'success')
      setCode('')
      setError(null)
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not resend code.', 'error')
    } finally {
      setResending(false)
    }
  }

  function continueWithoutVerification() {
    // SMS verification is unavailable in this build. The phone stays
    // unverified; the backend stores it as such.
    const next = updateOnboardingPhoneStep('deferred', user?.userId)
    if (!next) {
      setDraft(null)
      return
    }
    setDraft(next)
    void register(next)
  }

  return (
    <AuthLayout
      dark
      topBar={
        <Link
          to="/signup"
          aria-label="Back to signup"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
    >
      <div className="flex-1 flex flex-col items-center text-center animate-fade-in">
        <div className="mt-6 h-16 w-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Verify Your Phone</h1>

        {phoneStepDone ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs" role="status">
              {registering
                ? 'Creating your account…'
                : 'Your phone step is complete. Create your account to continue.'}
            </p>
            {registerFailure && (
              <div role="alert" className="mt-6 text-sm text-destructive max-w-xs">
                <p>{registerFailure.message}</p>
                {registerFailure.requestId && (
                  <p className="mt-1 text-xs text-muted-foreground">Reference: {registerFailure.requestId}</p>
                )}
              </div>
            )}
            <Button
              type="button"
              size="lg"
              className="w-full mt-8"
              loading={registering}
              onClick={() => void register(draft)}
            >
              {registerFailure ? 'Try again' : 'Create account'}
            </Button>
          </>
        ) : phoneVerification.available ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a 6-digit code to
              <br />
              <span className="font-medium text-foreground">{maskPhone(draft.phoneE164)}</span>
            </p>

            <div className="mt-8 w-full">
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={verify}
                invalid={!!error}
                disabled={submitting || registering}
              />
              {error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              Didn’t receive the code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={remaining > 0 || resending}
                className="text-primary font-semibold hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {remaining > 0 ? `Resend (${remaining}s)` : 'Resend'}
              </button>
            </p>

            <Button
              type="button"
              size="lg"
              className="w-full mt-6"
              onClick={() => verify(code)}
              loading={submitting || registering}
              disabled={code.length !== 6}
            >
              Verify
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              SMS verification isn’t available yet, so{' '}
              <span className="font-medium text-foreground">{maskPhone(draft.phoneE164)}</span> has not been
              verified. You can create your account now and verify your phone later.
            </p>
            <Button
              type="button"
              size="lg"
              className="w-full mt-8"
              loading={registering}
              onClick={continueWithoutVerification}
            >
              Continue
            </Button>
          </>
        )}

        <Link to="/signup" className="mt-4 text-sm font-semibold text-primary hover:underline">
          Change Phone Number
        </Link>

        {import.meta.env.DEV && phoneVerification.available && !phoneStepDone && (
          <p className="mt-6 text-xs text-muted-foreground">
            Dev-only mock: no SMS is sent. Use code{' '}
            <span className="font-mono text-foreground">{DEV_MOCK_OTP_CODE}</span>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
