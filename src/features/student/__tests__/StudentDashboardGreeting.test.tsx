import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { StudentDashboardPage } from '../pages/StudentDashboardPage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { dashboardFor, seedMockAuthUser } from '@/test/dashboardFixtures'
import { studentService } from '../data/studentService'
import { MOCK_DASHBOARD } from '../data/mockApplications'

describe('StudentDashboardPage greeting (backend student profile)', () => {
  beforeEach(() => {
    // Mock auth session is "Zed Auth" — it must never reach the greeting.
    seedMockAuthUser()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('greets the student by the backend-provided first name', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(
      dashboardFor({ firstName: 'Sarah', lastName: 'Johnson' })
    )
    renderWithProviders(<StudentDashboardPage />)

    expect(await screen.findByText(/^Good (morning|afternoon|evening), Sarah!$/)).toBeInTheDocument()
    expect(screen.queryByText(/Zed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/John/)).not.toBeInTheDocument()
    // Avatar link is labelled with the backend full name.
    expect(screen.getByRole('link', { name: 'Sarah Johnson, open profile' })).toBeInTheDocument()
  })

  it('a different student produces a different greeting', async () => {
    const spy = vi.spyOn(studentService, 'getDashboard')

    spy.mockResolvedValue(dashboardFor({ firstName: 'Sarah', lastName: 'Johnson' }))
    const first = renderWithProviders(<StudentDashboardPage />)
    expect(await screen.findByText(/, Sarah!$/)).toBeInTheDocument()
    first.unmount()

    spy.mockResolvedValue(dashboardFor({ firstName: 'Priya', lastName: 'Patel' }))
    renderWithProviders(<StudentDashboardPage />)
    expect(await screen.findByText(/, Priya!$/)).toBeInTheDocument()
    expect(screen.queryByText(/Sarah/)).not.toBeInTheDocument()
  })

  it('shows a neutral greeting — never John Doe — while loading', async () => {
    vi.spyOn(studentService, 'getDashboard').mockReturnValue(new Promise(() => {}))
    renderWithProviders(<StudentDashboardPage />)

    expect(await screen.findByText('Welcome back!')).toBeInTheDocument()
    expect(screen.queryByText(/John|Doe|Zed/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open profile' })).toBeInTheDocument()
  })

  it('shows a neutral greeting and the existing error + Retry when the API fails', async () => {
    vi.spyOn(studentService, 'getDashboard').mockRejectedValue(new Error('Boom'))
    renderWithProviders(<StudentDashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your dashboard/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByText('Welcome back!')).toBeInTheDocument()
    expect(screen.queryByText(/John|Doe|Zed/)).not.toBeInTheDocument()
  })

  it('keeps the dashboard working with a neutral greeting if data.student is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue({
      ...MOCK_DASHBOARD,
      student: undefined as never
    })
    renderWithProviders(<StudentDashboardPage />)

    // Statistics are unaffected by the profile problem…
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /monthly progress/i })).toBeInTheDocument()
    // …and the greeting stays neutral rather than showing any mock identity.
    expect(screen.getByText('Welcome back!')).toBeInTheDocument()
    expect(screen.queryByText(/John|Doe|Zed/)).not.toBeInTheDocument()
  })

  it('leaves monthly, today and weekly statistics unchanged', async () => {
    renderWithProviders(<StudentDashboardPage />)
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /today’s progress/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /weekly application activity/i })).toBeInTheDocument()
  })
})
