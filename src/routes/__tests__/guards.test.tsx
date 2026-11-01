import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequirePendingRegistration, RequireStudent } from '../guards'

function Protected() {
  return <div>protected</div>
}
function Login() {
  return <div>login-page</div>
}
function Signup() {
  return <div>signup-page</div>
}

function harness(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path="/student/dashboard"
                element={
                  <RequireStudent>
                    <Protected />
                  </RequireStudent>
                }
              />
              <Route
                path="/connect-google"
                element={
                  <RequirePendingRegistration needsPhoneVerified>
                    <Protected />
                  </RequirePendingRegistration>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

describe('route guards', () => {
  it('redirects unauthenticated student access to /login', async () => {
    harness('/student/dashboard')
    expect(await screen.findByText('login-page')).toBeInTheDocument()
  })

  it('redirects to /signup when no pending registration exists', async () => {
    harness('/connect-google')
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
  })
})
