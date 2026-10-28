import { describe, expect, it, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentProfilePage } from '../pages/StudentProfilePage'
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

describe('StudentProfilePage', () => {
  beforeEach(() => {
    seedUser()
  })

  it('renders student personal information from the authenticated user', async () => {
    renderWithProviders(<StudentProfilePage />)
    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
    expect(screen.getByText('+17135551234')).toBeInTheDocument()
    expect(screen.getByText(/Verified/i)).toBeInTheDocument()
  })

  it('Edit button opens the Coming Soon dialog', async () => {
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
})
