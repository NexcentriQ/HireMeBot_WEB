import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LogoMark } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { GraduateIllustration } from '@/components/common/GraduateIllustration'
import { useAuth } from '../AuthProvider'
import { readPendingRegistration } from '../services/MockAuthService'
import { useToast } from '@/components/common/ToastProvider'
import { AuthServiceError } from '../types'

export function ConnectGooglePage() {
  const navigate = useNavigate()
  const { authService } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [pending] = useState(() => readPendingRegistration())

  useEffect(() => {
    if (!pending) {
      navigate('/signup', { replace: true })
      return
    }
    if (!pending.phoneVerified) {
      navigate('/verify-phone', { replace: true })
    }
  }, [pending, navigate])

  if (!pending) return null

  async function handleContinue() {
    setLoading(true)
    try {
      const { redirectUrl } = await authService.startGoogleAuthentication({
        registrationId: pending!.registrationId
      })
      window.location.assign(redirectUrl)
    } catch (err) {
      setLoading(false)
      if (err instanceof AuthServiceError && err.code === 'PHONE_NOT_VERIFIED') {
        navigate('/verify-phone', { replace: true })
        return
      }
      toast.show(err instanceof Error ? err.message : 'Google sign-in could not start.', 'error')
    }
  }

  return (
    <AuthLayout
      topBar={
        <Link
          to="/verify-phone"
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
          Sign in with your Google account to complete your registration.
        </p>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full mt-8 bg-card"
          loading={loading}
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
