import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider, useAuth } from '../AuthProvider'
import { studentDashboardKey } from '@/features/student/hooks/useStudentDashboard'
import { useEffect } from 'react'

function Capture({ onLogout }: { onLogout: (fn: () => Promise<void>) => void }) {
  const { logout } = useAuth()
  useEffect(() => {
    onLogout(logout)
  }, [logout, onLogout])
  return null
}

describe('AuthProvider cache isolation', () => {
  it('removes every student-dashboard query entry on logout so a prior student\'s cache cannot leak', async () => {
    const client = new QueryClient()
    client.setQueryData(studentDashboardKey('old-student-1'), { marker: 'leak-1' })
    client.setQueryData(studentDashboardKey('old-student-2'), { marker: 'leak-2' })

    let doLogout: (() => Promise<void>) | undefined

    render(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Capture onLogout={(fn) => (doLogout = fn)} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    )

    expect(client.getQueryData(studentDashboardKey('old-student-1'))).toEqual({ marker: 'leak-1' })

    await act(async () => {
      await doLogout!()
    })

    expect(client.getQueryData(studentDashboardKey('old-student-1'))).toBeUndefined()
    expect(client.getQueryData(studentDashboardKey('old-student-2'))).toBeUndefined()
  })
})
