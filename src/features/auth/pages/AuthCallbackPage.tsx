import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '../AuthProvider'
import { readPendingRegistration } from '../services/MockAuthService'
import { AuthServiceError } from '../types'

type Status = 'processing' | 'error'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { authService, refresh } = useAuth()
  const [params] = useSearchParams()
  const [status, setStatus] = useState<Status>('processing')
  const [message, setMessage] = useState('Finishing your sign-in…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function run() {
      try {
        const callback = Object.fromEntries(params.entries())
        const result = await authService.completeGoogleAuthentication(callback)
        if (!result.emailVerified) {
          setStatus('error')
          setMessage('Google did not return a verified email. Please try again.')
          return
        }
        const pending = readPendingRegistration()
        if (!pending || !pending.phoneVerified) {
          setStatus('error')
          setMessage('We could not find a verified phone registration. Please start again.')
          return
        }
        await authService.activateStudentAccount({
          registrationId: pending.registrationId,
          sessionRef: result.sessionRef
        })
        await refresh()
        navigate('/signup-success', { replace: true })
      } catch (err) {
        setStatus('error')
        if (err instanceof AuthServiceError) {
          if (err.code === 'GOOGLE_CANCELLED') {
            setMessage('Sign-in was cancelled. You can try again when you’re ready.')
          } else if (err.code === 'ACCOUNT_CONFLICT') {
            setMessage('This Google account is already linked to another HireMeBot user.')
          } else {
            setMessage(err.message)
          }
        } else {
          setMessage('Something went wrong while completing sign-in.')
        }
      }
    }
    run()
  }, [authService, navigate, params, refresh])

  return (
    <AuthLayout dark>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        {status === 'processing' ? (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin" aria-hidden="true" />
            <p className="mt-5 text-base text-muted-foreground">{message}</p>
          </>
        ) : (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Sign-in incomplete</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">{message}</p>
            <div className="mt-6 w-full flex flex-col gap-3">
              <Button size="lg" onClick={() => navigate('/connect-google', { replace: true })}>
                Try again
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/signup', { replace: true })}>
                Back to signup
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
