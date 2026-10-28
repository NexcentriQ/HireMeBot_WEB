import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { OtpInput } from '../components/OtpInput'
import { useResendCountdown } from '../hooks/useResendCountdown'
import { useAuth } from '../AuthProvider'
import { readPendingRegistration, MOCK_OTP_CODE } from '../services/MockAuthService'
import { useToast } from '@/components/common/ToastProvider'
import { maskPhone } from '@/lib/utils'
import { AuthServiceError } from '../types'

export function VerifyPhonePage() {
  const navigate = useNavigate()
  const { authService } = useAuth()
  const toast = useToast()
  const [pending, setPending] = useState(() => readPendingRegistration())
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const { remaining, start } = useResendCountdown(60)

  useEffect(() => {
    if (!pending) {
      navigate('/signup', { replace: true })
    }
  }, [pending, navigate])

  if (!pending) return null

  async function verify(codeToSubmit: string) {
    setError(null)
    setSubmitting(true)
    try {
      await authService.verifyPhoneOtp({
        registrationId: pending!.registrationId,
        code: codeToSubmit
      })
      navigate('/connect-google')
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
      const { nextResendInSeconds } = await authService.resendPhoneOtp(pending!.registrationId)
      start(nextResendInSeconds)
      toast.show('A new code has been sent.', 'success')
      setCode('')
      setError(null)
      setPending(readPendingRegistration())
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not resend code.', 'error')
    } finally {
      setResending(false)
    }
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
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to
          <br />
          <span className="font-medium text-foreground">{maskPhone(pending.phoneE164)}</span>
        </p>

        <div className="mt-8 w-full">
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verify}
            invalid={!!error}
            disabled={submitting}
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
          loading={submitting}
          disabled={code.length !== 6}
        >
          Verify
        </Button>

        <Link to="/signup" className="mt-4 text-sm font-semibold text-primary hover:underline">
          Change Phone Number
        </Link>

        {import.meta.env.DEV && (
          <p className="mt-6 text-xs text-muted-foreground">
            Dev-only hint: use code <span className="font-mono text-foreground">{MOCK_OTP_CODE}</span>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
