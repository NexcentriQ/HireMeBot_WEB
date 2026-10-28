import { describe, expect, it, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentDashboardPage } from '../pages/StudentDashboardPage'
import { renderWithProviders } from '@/test/renderWithProviders'

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

  it('shows October 2026 with 22 weekdays and a 1,100 monthly target', async () => {
    renderWithProviders(<StudentDashboardPage />)
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    expect(screen.getByText('22 weekdays · 50 per day')).toBeInTheDocument()
    expect(screen.getByText(/1,100/)).toBeInTheDocument()
  })

  it('clicking the In Review preview card opens the coming-soon dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentDashboardPage />)
    const button = await screen.findByRole('button', { name: /In Review/i })
    await user.click(button)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/application review tracking/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /got it/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking Interviews opens the interview-specific dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentDashboardPage />)
    await user.click(await screen.findByRole('button', { name: /Interviews/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/interview tracking/i)).toBeInTheDocument()
  })

  it('clicking Offers opens the offers-specific dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentDashboardPage />)
    await user.click(await screen.findByRole('button', { name: /Offers/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/offer tracking/i)).toBeInTheDocument()
  })

  it('clicking Rejected opens the rejected-specific dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentDashboardPage />)
    await user.click(await screen.findByRole('button', { name: /Rejected/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/rejection insights/i)).toBeInTheDocument()
  })

  it('shows a weekly activity chart with the five weekday labels', async () => {
    renderWithProviders(<StudentDashboardPage />)
    const chart = await screen.findByRole('img', { name: /weekly application activity/i })
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      expect(within(chart).getByText(day)).toBeInTheDocument()
    }
  })
})
