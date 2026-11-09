import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { saveOnboardingDraft } from '@/features/auth/services/onboardingDraft'
import { setFakeCognitoUser } from '@/test/fakeAmplifyAuth'
import { queueFakeAccountResponse, setFakeAccount } from '@/test/fakeStudentAccountApi'
import {
  GuestOnly,
  RequireAccountStatus,
  RequireInterruptedSignup,
  RequirePendingRegistration,
  RequireSignupForm,
  RequireStudent,
  RootRedirect
} from '../guards'

function Login() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <div>login-page{from ? ` from=${from}` : ''}</div>
}

function harness(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/student/dashboard" element={<RequireStudent><div>dashboard-page</div></RequireStudent>} />
              <Route path="/signup" element={<RequireSignupForm><div>signup-page</div></RequireSignupForm>} />
              <Route path="/verify-phone" element={<RequirePendingRegistration><div>verify-page</div></RequirePendingRegistration>} />
              <Route path="/connect-google" element={<RequireInterruptedSignup><div>connect-google-page</div></RequireInterruptedSignup>} />
              <Route path="/account-status" element={<RequireAccountStatus><div>account-status-page</div></RequireAccountStatus>} />
              <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

const draftFor = (ownerSub: string) => ({
  ownerSub,
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneE164: '+17135551234',
  acceptedTerms: true
})

describe('route guards (backend account authorization)', () => {
  it('redirects unauthenticated student access to /login and remembers the destination', async () => {
    harness('/student/dashboard')
    expect(await screen.findByText('login-page from=/student/dashboard')).toBeInTheDocument()
  })

  it('shows a loading state (not the protected page) while the session and account checks run', () => {
    setFakeCognitoUser({ sub: 'abc' })
    harness('/student/dashboard')
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByText('dashboard-page')).not.toBeInTheDocument()
  })

  it('lets a registered ACTIVE student into /student/*', async () => {
    setFakeCognitoUser({ sub: 'abc' })
    harness('/student/dashboard')
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
  })

  it('keeps a Google user who is NOT a registered student out of /student/* (sends them to signup)', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    harness('/student/dashboard')
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
    expect(screen.queryByText('dashboard-page')).not.toBeInTheDocument()
  })

  it('sends a pending account to the status screen instead of the dashboard', async () => {
    setFakeCognitoUser({ sub: 'p' })
    setFakeAccount('p', { type: 'registered', status: 'PENDING' })
    harness('/student/dashboard')
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
  })

  it('sends a restricted identity to the status screen and never to the signup form', async () => {
    setFakeCognitoUser({ sub: 's' })
    queueFakeAccountResponse('lookup', {
      status: 403,
      body: { success: false, code: 'ACCOUNT_SUSPENDED', message: 'Your account is currently suspended.' }
    })
    harness('/signup')
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
    expect(screen.queryByText('signup-page')).not.toBeInTheDocument()
  })

  it('keeps registered students off the signup form', async () => {
    setFakeCognitoUser({ sub: 'abc' })
    harness('/signup')
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
  })

  it('requires a Google session for the signup form', async () => {
    harness('/signup')
    expect(await screen.findByText('login-page')).toBeInTheDocument()
  })

  it('routes signed-in users away from /login by account state', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    harness('/login')
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
  })

  it('requires this identity’s signup draft for the OTP step', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draftFor('someone-else'))
    harness('/verify-phone')
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
  })

  it('allows the OTP step with this identity’s draft', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draftFor('new'))
    harness('/verify-phone')
    expect(await screen.findByText('verify-page')).toBeInTheDocument()
  })

  it('sends a signed-out user with an interrupted signup to Continue with Google', async () => {
    saveOnboardingDraft(draftFor('new'))
    harness('/verify-phone')
    expect(await screen.findByText('connect-google-page')).toBeInTheDocument()
  })

  it('sends / to login, or to the reconnect screen when a signup was interrupted', async () => {
    const first = harness('/')
    expect(await screen.findByText('login-page')).toBeInTheDocument()
    first.unmount()
    saveOnboardingDraft(draftFor('new'))
    harness('/')
    expect(await screen.findByText('connect-google-page')).toBeInTheDocument()
  })

  it('shows the account-status screen (with retry) when the lookup keeps failing', async () => {
    setFakeCognitoUser({ sub: 'abc' })
    for (let i = 0; i < 4; i++) {
      queueFakeAccountResponse('lookup', { status: 503, body: { success: false, code: 'SERVICE_UNAVAILABLE' } })
    }
    harness('/student/dashboard')
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
  })
})
