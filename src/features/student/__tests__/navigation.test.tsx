import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/components/common/ToastProvider'
import { App } from '@/app/App'

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

function renderApp(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
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

describe('student navigation', () => {
  beforeEach(seedUser)

  it('notification bell navigates to the Notifications page', async () => {
    const user = userEvent.setup()
    renderApp('/student/dashboard')
    const bell = await screen.findByRole('link', { name: /notifications/i })
    await user.click(bell)
    expect(await screen.findByText(/notifications coming soon/i)).toBeInTheDocument()
  })

  it('Applications bottom-nav lands on the applications list', async () => {
    const user = userEvent.setup()
    renderApp('/student/dashboard')
    const nav = await screen.findByRole('navigation', { name: /primary/i })
    const link = within(nav).getByRole('link', { name: 'Applications' })
    await user.click(link)
    expect(await screen.findByRole('heading', { name: /today's applications/i })).toBeInTheDocument()
  })

  it('clicking an application from the list navigates to its details', async () => {
    const user = userEvent.setup()
    renderApp('/student/applications')
    const link = (await screen.findAllByRole('link', { name: /^Amazon/i }))[0]
    await user.click(link)
    expect(await screen.findByRole('heading', { name: /^Amazon$/i })).toBeInTheDocument()
  })

  it('protects student routes when no user is logged in', async () => {
    window.localStorage.clear()
    renderApp('/student/dashboard')
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })
})
