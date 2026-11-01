import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/components/common/ToastProvider'
import { StudentDashboardPage } from '../pages/StudentDashboardPage'
import { studentDashboardKey } from '../hooks/useStudentDashboard'
import { MOCK_DASHBOARD } from '../data/mockApplications'
import { studentService } from '../data/studentService'

function seedUser() {
  window.localStorage.setItem(
    'hmb.mock.user',
    JSON.stringify({
      id: 'u1',
      role: 'STUDENT',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneE164: '+17135551234',
      activated: true
    })
  )
}

/**
 * These tests cover Enhancement 2 — a background refetch that fails while
 * previously-cached data exists must surface a non-destructive banner so
 * stale values are never silently rendered as fresh.
 */
describe('StudentDashboardPage — refetch-error banner', () => {
  beforeEach(() => {
    seedUser()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the previously-loaded data AND an amber refresh-failed banner when a refetch fails after success', async () => {
    // Pre-seed the cache with the last successful dashboard, then make the
    // next service call reject to simulate a failed background refetch.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(studentDashboardKey(), MOCK_DASHBOARD)
    const spy = vi
      .spyOn(studentService, 'getDashboard')
      .mockRejectedValue(new Error('Boom from the backend'))

    render(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <AuthProvider>
              <ToastProvider>
                <StudentDashboardPage />
              </ToastProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    )

    // Trigger the refetch (the Refresh button in the header).
    const refresh = await screen.findByRole('button', { name: /refresh dashboard/i })
    refresh.click()

    // Wait for the banner.
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/showing previously loaded data/i)
    expect(banner).toHaveTextContent(/boom from the backend/i)

    // Previously-cached figures are still visible (815 is NOT in the mock —
    // 820 is, from monthlyProgress.applied).
    expect(screen.getByText('820')).toBeInTheDocument()

    // The Retry button inside the banner (NOT the main-blocking Retry).
    expect(screen.getByRole('button', { name: /retry refresh/i })).toBeInTheDocument()

    expect(spy).toHaveBeenCalled()
  })
})
