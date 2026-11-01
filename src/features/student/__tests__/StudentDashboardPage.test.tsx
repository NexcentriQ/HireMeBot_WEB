import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentDashboardPage } from '../pages/StudentDashboardPage'
import { renderWithProviders } from '@/test/renderWithProviders'
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

describe('StudentDashboardPage', () => {
  beforeEach(() => {
    seedUser()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders monthly stats from the backend response', async () => {
    renderWithProviders(<StudentDashboardPage />)
    // Monthly: 820 / 1,100 — 75%
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(screen.getByText(/\/ 1,100/)).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('280 remaining')).toBeInTheDocument()
  })

  it('renders today’s stats from the backend response', async () => {
    renderWithProviders(<StudentDashboardPage />)
    const today = MOCK_DASHBOARD.statistics.todayProgress
    // Anchor on the progressbar aria-label specific to today's card.
    const bar = await screen.findByRole('progressbar', { name: /today’s progress/i })
    expect(bar).toHaveAttribute('aria-valuenow', String(Math.min(100, today.percentage)))
    expect(screen.getByText(new RegExp(`^/ ${today.target}$`))).toBeInTheDocument()
  })

  it('renders a weekly chart with exactly five backend-labeled weekdays', async () => {
    renderWithProviders(<StudentDashboardPage />)
    const chart = await screen.findByRole('img', { name: /weekly application activity/i })
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      expect(within(chart).getByText(day)).toBeInTheDocument()
    }
  })

  it('preview tiles show sample numbers + a Coming Soon pill and open the dialog on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentDashboardPage />)
    // Sample preview numbers are visible for visual rhythm (the backend does
    // not supply these; the pill advertises the preview nature).
    const inReview = await screen.findByRole('button', { name: /In Review/i })
    expect(within(inReview).getByText('126')).toBeInTheDocument()
    expect(within(inReview).getByText(/coming soon/i)).toBeInTheDocument()
    await user.click(inReview)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/application review tracking/i)).toBeInTheDocument()
  })

  it('shows an error state with a Retry action and no fabricated numbers when the API fails', async () => {
    vi.spyOn(studentService, 'getDashboard').mockRejectedValue(new Error('Boom'))
    renderWithProviders(<StudentDashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your dashboard/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // Must not display the previously-cached mock numbers as if they were real.
    expect(screen.queryByText('820')).not.toBeInTheDocument()
    expect(screen.queryByText('126')).not.toBeInTheDocument()
  })
})
