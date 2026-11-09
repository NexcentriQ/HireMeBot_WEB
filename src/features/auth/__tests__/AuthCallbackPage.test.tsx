import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StrictMode, useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '../AuthProvider'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { readRedirectIntent, saveRedirectIntent } from '../services/redirectIntent'
import { readOnboardingDraft, saveOnboardingDraft, updateOnboardingPhoneStep } from '../services/onboardingDraft'
import { fakeAccountApiCallCount, queueFakeAccountResponse, setFakeAccount } from '@/test/fakeStudentAccountApi'
import { resetRedirectOutcomeRecorder, startRedirectOutcomeRecorder } from '../services/redirectOutcome'
import { FAKE_ACCESS_TOKEN, FAKE_ID_TOKEN, fetchAuthSession, setFakeCognitoUser } from '@/test/fakeAmplifyAuth'

const seenLocationKeys: string[] = []

function LocationLog() {
  const location = useLocation()
  useEffect(() => {
    if (!seenLocationKeys.includes(location.key)) seenLocationKeys.push(location.key)
  }, [location.key])
  return null
}

function renderCallback({ search = '?code=abc&state=xyz', strict = false } = {}) {
  window.history.replaceState({}, '', `/auth/callback${search}`)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (
    <ThemeProvider>
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthProvider>
          <LocationLog />
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/student/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/student/applications" element={<div>applications-page</div>} />
            <Route path="/account-status" element={<div>account-status-page</div>} />
            <Route path="/connect-google" element={<div>connect-google-page</div>} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/signup" element={<div>signup-page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
    </ThemeProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    seenLocationKeys.length = 0
    startRedirectOutcomeRecorder()
  })
  afterEach(() => {
    resetRedirectOutcomeRecorder()
    window.history.replaceState({}, '', '/')
  })

  it('lands on the student dashboard after a successful login', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    saveRedirectIntent('login')
    renderCallback()
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
    expect(readRedirectIntent()).toBeNull()
  })

  it('resumes the page the user originally requested', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    saveRedirectIntent('login', '/student/applications')
    renderCallback()
    expect(await screen.findByText('applications-page')).toBeInTheDocument()
  })

  it('asks the backend (GET /auth/me) once the session is ready', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderCallback()
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
    expect(fakeAccountApiCallCount('lookup')).toBeGreaterThanOrEqual(1)
  })

  it('sends a new Google user (SIGNUP_FORM) to the signup form', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveRedirectIntent('login', '/student/applications')
    renderCallback()
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
  })

  it('restores an interrupted signup draft for the same Google account', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft({ ownerSub: 'new', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    updateOnboardingPhoneStep('dev-simulated')
    renderCallback()
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
    expect(readOnboardingDraft('new')?.firstName).toBe('Ada')
    // Google sign-in never turns the simulated phone step into a verification.
    expect(readOnboardingDraft('new')?.phoneStep).toBe('dev-simulated')
  })

  it('discards the draft when the user comes back with a different Google account', async () => {
    setFakeCognitoUser({ sub: 'other' })
    setFakeAccount('other', { type: 'unregistered' })
    saveOnboardingDraft({ ownerSub: 'new', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    renderCallback()
    expect(await screen.findByText('signup-page')).toBeInTheDocument()
    expect(readOnboardingDraft()).toBeNull()
  })

  it('clears a leftover draft when the account turns out to be registered already', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    saveOnboardingDraft({ ownerSub: 'sub-1', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    renderCallback()
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
    expect(readOnboardingDraft()).toBeNull()
  })

  it('sends a pending account to the account-status screen', async () => {
    setFakeCognitoUser({ sub: 'p' })
    setFakeAccount('p', { type: 'registered', status: 'PENDING' })
    renderCallback()
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
  })

  it.each([
    [403, 'ACCOUNT_DELETED'],
    [403, 'ACCOUNT_TYPE_MISMATCH'],
    [403, 'EMAIL_NOT_VERIFIED'],
    [409, 'ACCOUNT_IDENTITY_CONFLICT']
  ])('sends a %i %s identity to the account-status screen (never signup) and clears the draft', async (status, code) => {
    setFakeCognitoUser({ sub: 'x' })
    saveOnboardingDraft({ ownerSub: 'x', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    queueFakeAccountResponse('lookup', { status, body: { success: false, code, message: 'msg' } })
    renderCallback()
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
    expect(readOnboardingDraft()).toBeNull()
  })

  it('keeps the draft when the lookup fails temporarily', async () => {
    setFakeCognitoUser({ sub: 'x' })
    saveOnboardingDraft({ ownerSub: 'x', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    queueFakeAccountResponse('lookup', { status: 500, body: { success: false, code: 'INTERNAL_ERROR', requestId: 'r' } })
    renderCallback()
    expect(await screen.findByText('account-status-page')).toBeInTheDocument()
    expect(readOnboardingDraft('x')).not.toBeNull()
  })

  it('redirects exactly once under React StrictMode', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderCallback({ strict: true })
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
    expect(seenLocationKeys).toHaveLength(2) // callback → dashboard
  })

  it('keeps showing progress (no error) while Amplify is still exchanging the code', async () => {
    let release!: () => void
    const exchange = new Promise<void>((r) => (release = r))
    fetchAuthSession.mockImplementation(async () => {
      await exchange
      return {
        tokens: {
          idToken: { payload: { sub: 'sub-1' }, toString: () => FAKE_ID_TOKEN },
          accessToken: { payload: {}, toString: () => FAKE_ACCESS_TOKEN }
        }
      }
    })
    setFakeCognitoUser({ sub: 'sub-1' })
    renderCallback()
    expect(screen.getByText('Finishing your sign-in…')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText('Sign-in incomplete')).not.toBeInTheDocument()
    release()
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument()
  })

  it('explains a cancelled Google sign-in and lets the user retry from the right screen', async () => {
    const user = userEvent.setup()
    saveOnboardingDraft({ ownerSub: 'sub-1', firstName: 'Ada', lastName: 'L', phoneE164: '+17135551234', acceptedTerms: true })
    updateOnboardingPhoneStep('dev-simulated')
    saveRedirectIntent('signup')
    renderCallback({ search: '?error=access_denied&error_description=User+cancelled+the+login' })
    expect(await screen.findByText('Sign-in incomplete')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelled/i)
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('connect-google-page')).toBeInTheDocument()
  })

  it('shows a safe message when the account is rejected, without leaking tokens', async () => {
    renderCallback({ search: '?error=invalid_request&error_description=Not+a+test+user' })
    expect(await screen.findByText('Sign-in incomplete')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/may not be allowed/i)
    expect(document.body.textContent).not.toContain(FAKE_ID_TOKEN)
    expect(document.body.textContent).not.toContain(FAKE_ACCESS_TOKEN)
  })

  it('reports an error when there is no sign-in in progress and no session', async () => {
    renderCallback({ search: '' })
    expect(await screen.findByText('Sign-in incomplete')).toBeInTheDocument()
  })
})
