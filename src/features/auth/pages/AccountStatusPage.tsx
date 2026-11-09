import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { useAuth } from '../AuthProvider'
import { routeForAccount, type AccountState } from '../account'
import type { RestrictionCode } from '../services/studentAccountApi'

type View = {
  icon: 'pending' | 'restricted' | 'error'
  title: string
  message: string
  requestId: string | null
  /** Offer "Check again" (re-runs GET /auth/me). */
  canRetry: boolean
  signOutLabel: string
}

const RESTRICTION_TITLES: Record<RestrictionCode, string> = {
  ACCOUNT_SUSPENDED: 'Account suspended',
  ACCOUNT_DELETED: 'Account unavailable',
  ACCOUNT_TYPE_MISMATCH: 'Not a student account',
  GOOGLE_ACCOUNT_REQUIRED: 'Use Continue with Google',
  EMAIL_NOT_VERIFIED: 'Email not verified',
  ACCOUNT_IDENTITY_CONFLICT: 'Account recovery needed'
}

/** Extra guidance shown under the backend's (display-safe) message. */
const RESTRICTION_HINTS: Partial<Record<RestrictionCode, string>> = {
  ACCOUNT_TYPE_MISMATCH: 'HireMeBot for students needs a student account. Try a different Google account.',
  EMAIL_NOT_VERIFIED: 'Try a different Google account with a verified email address.',
  ACCOUNT_IDENTITY_CONFLICT: 'Please contact HireMeBot support to recover access.'
}

function viewFor(account: AccountState): View | null {
  switch (account.status) {
    case 'pending':
      return {
        icon: 'pending',
        title: 'Account pending',
        message:
          'Your HireMeBot student account isn’t active yet. You’ll be able to use the dashboard as soon as it is.',
        requestId: null,
        canRetry: true,
        signOutLabel: 'Sign out'
      }
    case 'restricted': {
      const hint = RESTRICTION_HINTS[account.code]
      const differentAccount =
        account.code === 'ACCOUNT_TYPE_MISMATCH' ||
        account.code === 'EMAIL_NOT_VERIFIED' ||
        account.code === 'GOOGLE_ACCOUNT_REQUIRED'
      return {
        icon: 'restricted',
        title: RESTRICTION_TITLES[account.code],
        message: hint ? `${account.message} ${hint}` : account.message,
        requestId: account.requestId,
        canRetry: false,
        signOutLabel: differentAccount ? 'Use a different Google account' : 'Sign out'
      }
    }
    case 'error':
      return {
        icon: 'error',
        title: 'We couldn’t load your account',
        message: account.message,
        requestId: account.requestId,
        canRetry: true,
        signOutLabel: 'Sign out'
      }
    default:
      return null
  }
}

/**
 * Pending, restricted (403/409), and "account lookup failed" screens.
 * Restricted identities are never offered the signup form.
 */
export function AccountStatusPage() {
  const navigate = useNavigate()
  const { account, refresh, logout } = useAuth()
  const [checking, setChecking] = useState(false)
  const view = viewFor(account)
  if (!view) return null

  async function checkAgain() {
    if (checking) return
    setChecking(true)
    try {
      const snapshot = await refresh()
      navigate(routeForAccount(snapshot.account), { replace: true })
    } finally {
      setChecking(false)
    }
  }

  const Icon = view.icon === 'pending' ? Clock : view.icon === 'restricted' ? ShieldAlert : AlertTriangle
  const iconClass =
    view.icon === 'pending' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'

  return (
    <AuthLayout dark>
      <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center ${iconClass}`}>
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold">{view.title}</h1>
        <p role={view.icon === 'pending' ? 'status' : 'alert'} className="mt-2 text-sm text-muted-foreground max-w-sm">
          {view.message}
        </p>
        {view.requestId && <p className="mt-2 text-xs text-muted-foreground">Reference: {view.requestId}</p>}
        <div className="mt-6 w-full flex flex-col gap-3">
          {view.canRetry && (
            <Button size="lg" loading={checking} onClick={() => void checkAgain()}>
              {view.icon === 'error' ? 'Try again' : 'Check again'}
            </Button>
          )}
          <Button variant={view.canRetry ? 'outline' : 'default'} size="lg" onClick={() => void logout()}>
            {view.signOutLabel}
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
