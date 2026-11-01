import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { mockAuthService } from './services/MockAuthService'
import type { AuthService, AuthenticatedUser } from './types'

type AuthContextValue = {
  user: AuthenticatedUser | null
  loading: boolean
  authService: AuthService
  setUser: (u: AuthenticatedUser | null) => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * The frontend currently uses the mock service. To switch to Cognito,
 * instantiate CognitoAuthService with env config and swap the reference below.
 */
const authService: AuthService = mockAuthService

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  const setUser = useCallback((next: AuthenticatedUser | null) => {
    setUserState(next)
  }, [])

  const refresh = useCallback(async () => {
    const current = await authService.getCurrentUser()
    setUserState(current)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUserState(null)
    // Drop every student-dashboard query so the next sign-in cannot read a
    // prior student's cached response.
    queryClient.removeQueries({ queryKey: ['student-dashboard'] })
  }, [queryClient])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const current = await authService.getCurrentUser()
        if (!cancelled) setUserState(current)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, authService, setUser, logout, refresh }),
    [user, loading, setUser, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
