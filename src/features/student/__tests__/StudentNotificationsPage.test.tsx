import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentNotificationsPage } from '../pages/StudentNotificationsPage'
import { renderWithProviders } from '@/test/renderWithProviders'

describe('StudentNotificationsPage', () => {
  it('defaults to the All tab with its empty state copy', async () => {
    renderWithProviders(<StudentNotificationsPage />)
    expect(await screen.findByText(/notifications coming soon/i)).toBeInTheDocument()
  })

  it('switches to Application Updates and shows that empty state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentNotificationsPage />)
    await user.click(screen.getByRole('tab', { name: /application updates/i }))
    expect(await screen.findByText(/application updates coming soon/i)).toBeInTheDocument()
  })

  it('switches to System and shows that empty state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentNotificationsPage />)
    await user.click(screen.getByRole('tab', { name: /^system$/i }))
    expect(await screen.findByText(/system notifications coming soon/i)).toBeInTheDocument()
  })

  it('does not render fake notification records', async () => {
    renderWithProviders(<StudentNotificationsPage />)
    expect(screen.queryByText(/interview scheduled/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/application in review/i)).not.toBeInTheDocument()
  })
})
