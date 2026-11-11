import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/components/common/ToastProvider'
import { App } from '@/app/App'
import { studentService } from '../data/studentService'
import { studentDashboardKey } from '../hooks/useStudentDashboard'
import { dashboardFor, seedMockAuthUser } from '@/test/dashboardFixtures'
import { FAKE_STUDENT_ID } from '@/test/fakeStudentAccountApi'
import type { DashboardResponse } from '../data/apiTypes'

function renderApp(route: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    client,
    ...render(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[route]}>
            <AuthProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    )
  }
}

const SARAH = { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@example.com' }

describe('student profile shares the dashboard cache', () => {
  beforeEach(() => {
    seedMockAuthUser()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Dashboard → Profile → Applications → Home makes exactly ONE dashboard request', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))
    const user = userEvent.setup()
    renderApp('/student/dashboard')

    // Dashboard greeting comes from data.student.
    expect(await screen.findByText(/, Sarah!$/)).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // → Profile: same cached response, no new request.
    await user.click(screen.getByRole('link', { name: 'Sarah Johnson, open profile' }))
    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(screen.getByText('sarah.johnson@example.com')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // → Applications and back Home: still no new request.
    const nav = screen.getByRole('navigation', { name: /primary/i })
    await user.click(within(nav).getByRole('link', { name: 'Applications' }))
    expect(await screen.findByRole('heading', { name: /today's applications/i })).toBeInTheDocument()
    await user.click(within(nav).getByRole('link', { name: 'Home' }))
    expect(await screen.findByText(/, Sarah!$/)).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a deep link to /student/profile fetches once, from the dashboard endpoint only', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))
    renderApp('/student/profile')
    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a browser refresh (fresh QueryClient) fetches the profile again', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))

    const first = renderApp('/student/profile')
    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)
    first.unmount()

    // A reload discards the in-memory cache: new client, new request.
    renderApp('/student/profile')
    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('logout clears the cached student data', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))
    const user = userEvent.setup()
    const { client } = renderApp('/student/profile')

    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(client.getQueryData(studentDashboardKey(FAKE_STUDENT_ID))).toBeDefined()

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(client.getQueryData(studentDashboardKey(FAKE_STUDENT_ID))).toBeUndefined()
    expect(screen.queryByText(/Sarah/)).not.toBeInTheDocument()
  })

  it('switching to another student never exposes the previous student’s profile', async () => {
    // Student "A" is already in the cache under their own key.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(
      studentDashboardKey('1000000001'),
      dashboardFor({ firstName: 'Alice', lastName: 'Anderson', email: 'alice@example.com' })
    )

    // The signed-in student is now "B" (FAKE_STUDENT_ID, from GET /auth/me);
    // B's response is still in flight.
    let resolveB!: (d: DashboardResponse) => void
    vi.spyOn(studentService, 'getDashboard').mockReturnValue(
      new Promise<DashboardResponse>((res) => {
        resolveB = res
      })
    )

    renderApp('/student/profile', client)

    // While B loads: skeleton only — nothing of Alice.
    expect(await screen.findByText(/loading profile/i)).toBeInTheDocument()
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument()
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()

    resolveB(dashboardFor({ firstName: 'Bob', lastName: 'Brown', email: 'bob@example.com' }))
    expect(await screen.findByRole('heading', { name: 'Bob Brown' })).toBeInTheDocument()
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument()
  })
})
