import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { readPendingRegistration } from '@/features/auth/services/MockAuthService'

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (user?.activated) return <Navigate to="/student/dashboard" replace />
  return <>{children}</>
}

export function RequireStudent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== 'STUDENT') return <Navigate to="/login" replace />
  if (!user.activated) return <Navigate to="/connect-google" replace />
  return <>{children}</>
}

export function RequirePendingRegistration({
  needsPhoneVerified = false,
  children
}: {
  needsPhoneVerified?: boolean
  children: React.ReactNode
}) {
  const pending = readPendingRegistration()
  if (!pending) return <Navigate to="/signup" replace />
  if (needsPhoneVerified && !pending.phoneVerified) return <Navigate to="/verify-phone" replace />
  return <>{children}</>
}

export function RequireActivatedUser({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <SplashScreen />
  if (!user?.activated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SplashScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background text-foreground">
      <div
        aria-label="Loading"
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-r-transparent"
      />
    </div>
  )
}
