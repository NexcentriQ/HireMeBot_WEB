import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentProfilePage } from '../pages/StudentProfilePage'
import { renderWithProviders } from '@/test/renderWithProviders'
import { dashboardFor, seedMockAuthUser } from '@/test/dashboardFixtures'
import { studentService } from '../data/studentService'
import { MOCK_DASHBOARD } from '../data/mockApplications'

const SARAH = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah.johnson@example.com',
  phoneE164: '+17135550123',
  phoneVerified: true
}

describe('StudentProfilePage', () => {
  beforeEach(() => {
    // Mock auth session ("Zed Auth") deliberately differs from every backend
    // profile below — if any of its fields appear, the page read the wrong source.
    seedMockAuthUser()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders first name, last name, full name, email and phone from the backend student', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))
    renderWithProviders(<StudentProfilePage />)

    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(screen.getByText('Sarah')).toBeInTheDocument() // First Name row
    expect(screen.getByText('Johnson')).toBeInTheDocument() // Last Name row
    expect(screen.getByText('sarah.johnson@example.com')).toBeInTheDocument()
    expect(screen.getByText('+17135550123')).toBeInTheDocument()

    // Nothing from the mock auth session leaks into the page.
    expect(screen.queryByText(/Zed/)).not.toBeInTheDocument()
    expect(screen.queryByText('zed.auth@mock-session.test')).not.toBeInTheDocument()
    expect(screen.queryByText('+10000000000')).not.toBeInTheDocument()
  })

  it('shows "Verified" when phoneVerified is true', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(
      dashboardFor({ ...SARAH, phoneVerified: true })
    )
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByText('Verified')).toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
  })

  it('shows "Not Verified" (and not "Verified") when phoneVerified is false', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(
      dashboardFor({ ...SARAH, phoneVerified: false })
    )
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByText('Not Verified')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  it('shows "Not available" and NO verification badge when phoneE164 is null', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(
      dashboardFor({ ...SARAH, phoneE164: null, phoneVerified: true })
    )
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByText('Not available')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Verified')).not.toBeInTheDocument()
  })

  it('shows a skeleton — not mock identity — while the dashboard is loading', async () => {
    vi.spyOn(studentService, 'getDashboard').mockReturnValue(new Promise(() => {}))
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByText(/loading profile/i)).toBeInTheDocument()
    expect(screen.queryByText(/John/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Zed/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Doe|Auth/ })).not.toBeInTheDocument()
  })

  it('shows an error with Retry — no mock identity — when the API fails, and Retry recovers', async () => {
    const spy = vi
      .spyOn(studentService, 'getDashboard')
      .mockRejectedValueOnce(new Error('Backend down'))
      .mockResolvedValue(dashboardFor(SARAH))
    const user = userEvent.setup()
    renderWithProviders(<StudentProfilePage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not load your profile/i)
    expect(alert).toHaveTextContent(/backend down/i)
    expect(screen.queryByText(/John/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Zed/)).not.toBeInTheDocument()
    // Account & Settings stays usable so the student can still sign out.
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: /retry/i }))
    expect(await screen.findByRole('heading', { name: 'Sarah Johnson' })).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('shows a safe "profile unavailable" error when data.student is missing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue({
      ...MOCK_DASHBOARD,
      student: undefined as never
    })
    renderWithProviders(<StudentProfilePage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/profile details are unavailable/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByText(/John|Zed/)).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[student-profile]'))
  })

  it('treats a malformed student (wrong field type) as a contract error and logs field names only', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(
      dashboardFor({ ...SARAH, phoneVerified: 'yes' as never })
    )
    renderWithProviders(<StudentProfilePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/profile details are unavailable/i)
    const logged = consoleError.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('phoneVerified')
    expect(logged).not.toContain('sarah.johnson@example.com') // no PII in logs
  })

  it('Edit button opens the Coming Soon dialog', async () => {
    vi.spyOn(studentService, 'getDashboard').mockResolvedValue(dashboardFor(SARAH))
    const user = userEvent.setup()
    renderWithProviders(<StudentProfilePage />)
    await user.click(await screen.findByRole('button', { name: /edit/i }))
    expect(await screen.findByText(/profile editing coming soon/i)).toBeInTheDocument()
  })

  it('Theme button cycles through System → Light → Dark', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentProfilePage />)
    const themeBtn = await screen.findByRole('button', { name: /^theme\b/i })
    expect(themeBtn).toHaveTextContent('System')
    await user.click(themeBtn)
    expect(themeBtn).toHaveTextContent('Light')
    await user.click(themeBtn)
    expect(themeBtn).toHaveTextContent('Dark')
  })

  it('in mock mode renders the mock dashboard student (not the mock auth session)', async () => {
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByRole('heading', { name: 'John Doe' })).toBeInTheDocument()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    expect(screen.getByText('+17135550123')).toBeInTheDocument()
    expect(screen.queryByText(/Zed/)).not.toBeInTheDocument()
  })
})
