import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/common/GoogleIcon'
import { useAuth } from '@/features/auth/AuthProvider'
import { useToast } from '@/components/common/ToastProvider'

export function LoginPage() {
  const navigate = useNavigate()
  const { authService, refresh } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    try {
      // MOCK FLOW: existing-user login creates an activated student session
      // and navigates to the dashboard. Real Cognito flow would redirect
      // through the hosted UI and return via /auth/callback.
      const result = await authService.completeGoogleAuthentication({})
      if (!result.emailVerified) {
        toast.show('Your Google email is not verified.', 'error')
        return
      }
      // For login we synthesize a demo user via activateStudentAccount's path
      // only when a pending registration exists. For a plain login demo we
      // create a minimal activated student in storage.
      const demoUser = {
        id: 'demo-student',
        role: 'STUDENT' as const,
        firstName: 'John',
        lastName: 'Doe',
        email: result.email,
        phoneE164: '+17135551234',
        activated: true
      }
      window.localStorage.setItem('hmb.mock.user', JSON.stringify(demoUser))
      await refresh()
      navigate('/student/dashboard', { replace: true })
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Sign-in failed.', 'error')
    } finally {
      setLoading(false)
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
            onClick={handleGoogle}
            loading={loading}
          >
            <GoogleIcon />
            <span className="font-semibold">Continue with Google</span>
          </Button>
          <p className="text-sm text-muted-foreground">
            Don’t have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Sign Up
            </Link>
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
