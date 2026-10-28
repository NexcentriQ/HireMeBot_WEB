import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentApplicationsPage } from '../pages/StudentApplicationsPage'
import { renderWithProviders } from '@/test/renderWithProviders'

describe('StudentApplicationsPage', () => {
  it('searches by company name (case-insensitive)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)
    const input = await screen.findByLabelText(/search applications/i)
    await user.type(input, 'microsoft')
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    expect(screen.queryByText('Google')).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StudentApplicationsPage />)
    const input = await screen.findByLabelText(/search applications/i)
    await user.type(input, 'nothing matches zzz')
    expect(screen.getByText(/no applications found/i)).toBeInTheDocument()
  })

  it('sorts the list by newest first', async () => {
    renderWithProviders(<StudentApplicationsPage />)
    const items = await screen.findAllByRole('link')
    // The first application card should be Amazon (Oct 15, 2026)
    const firstCard = items.find((el) => el.getAttribute('aria-label')?.startsWith('Amazon'))
    const first = items[0]
    expect(first).toBe(firstCard)
  })
})
