import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '../AuthProvider'
import { ToastProvider } from '@/components/common/ToastProvider'
import { App } from '@/app/App'
import { readOnboardingDraft, saveOnboardingDraft, updateOnboardingPhoneStep } from '../services/onboardingDraft'
import { readRedirectIntent } from '../services/redirectIntent'
import { FAKE_ACCESS_TOKEN, setFakeCognitoUser, signInWithRedirect, signOut } from '@/test/fakeAmplifyAuth'
import {
  fakeAccountApiCallCount,
  fakeAccountApiCalls,
  fakeAccountFetch,
  queueFakeAccountResponse,
  setFakeAccount
} from '@/test/fakeStudentAccountApi'

/**
 * End-to-end journeys through the real routes, guards, AuthProvider and
 * account API client, against in-memory Cognito and backend fakes.
 *
 *   New student:      Google → SignupForm → dev OTP → POST /students/register → Dashboard
 *   Existing student: Google → Dashboard
 */

function CurrentPath() {
  return <div data-testid="path">{useLocation().pathname}</div>
}

function renderApp(entry: string | { pathname: string; state?: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <AuthProvider>
            <ToastProvider>
              <App />
              <CurrentPath />
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

const NEW_SUB = 'google-new'
const draftInput = {
  ownerSub: NEW_SUB,
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneE164: '+17135551234',
  acceptedTerms: true
}

/** A Google identity the backend answers SIGNUP_FORM for. */
function signInNewStudent() {
  setFakeCognitoUser({ sub: NEW_SUB, email: 'ada@gmail.com', emailVerified: true })
  setFakeAccount(NEW_SUB, { type: 'unregistered' })
}

async function typeOtp(user: ReturnType<typeof userEvent.setup>, code: string) {
  const digits = screen.getAllByLabelText(/^Digit \d$/)
  for (let i = 0; i < code.length; i++) await user.type(digits[i]!, code[i]!)
}

async function fillSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('First name'), 'Ada')
  await user.type(screen.getByLabelText('Last name'), 'Lovelace')
  await user.type(screen.getByLabelText('US phone number'), '7135551234')
  await user.click(screen.getByRole('checkbox'))
}

function registerCalls() {
  return fakeAccountApiCalls.filter((c) => c.endpoint === 'register')
}

describe('New student: Google → SignupForm → dev OTP → Register → Dashboard', () => {
  it('completes the whole journey with exactly one registration request', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    renderApp('/login')

    // GuestOnly + GET /auth/me (SIGNUP_FORM) put a signed-in newcomer on the form.
    expect(await screen.findByRole('heading', { name: 'Create Your Account' })).toBeInTheDocument()
    expect(screen.getByText('ada@gmail.com')).toBeInTheDocument() // read-only, from Cognito

    await fillSignupForm(user)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Draft saved for this identity; nothing sent to the backend yet.
    expect(await screen.findByText('Verify Your Phone')).toBeInTheDocument()
    expect(readOnboardingDraft(NEW_SUB)).toMatchObject({ firstName: 'Ada', phoneStep: 'pending' })
    expect(fakeAccountApiCallCount('register')).toBe(0)

    await typeOtp(user, '123456')

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    expect(registerCalls()).toHaveLength(1)
    expect(registerCalls()[0]).toMatchObject({
      method: 'POST',
      authorization: `Bearer ${FAKE_ACCESS_TOKEN}`,
      body: { firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '+17135551234', acceptedTerms: true }
    })
    // No OTP value or verification claim is ever sent.
    expect(JSON.stringify(registerCalls()[0]!.body)).not.toMatch(/otp|123456|verified|email/i)
    expect(readOnboardingDraft()).toBeNull()
  })

  it('blocks submission until names, a valid phone, and terms are provided', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    renderApp('/signup')
    const submit = await screen.findByRole('button', { name: /continue/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('First name'), 'Ada')
    await user.type(screen.getByLabelText('Last name'), 'Lovelace')
    await user.type(screen.getByLabelText('US phone number'), '7135551234')
    expect(submit).toBeDisabled() // terms not accepted yet

    await user.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(submit).toBeEnabled())

    await user.clear(screen.getByLabelText('US phone number'))
    await user.type(screen.getByLabelText('US phone number'), '123')
    expect(await screen.findByText('Enter a valid phone number')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    await user.clear(screen.getByLabelText('US phone number'))
    await user.type(screen.getByLabelText('US phone number'), '7135551234')
    await user.clear(screen.getByLabelText('First name'))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(submit).toBeDisabled()

    // Backend rule: names must start with a letter.
    await user.type(screen.getByLabelText('First name'), '.Ada')
    expect(await screen.findByText(/starting with a letter/)).toBeInTheDocument()
    expect(readOnboardingDraft()).toBeNull()
  })

  it('restores the form for the same Google account', async () => {
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/signup')
    expect(await screen.findByLabelText('First name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Last name')).toHaveValue('Lovelace')
    expect(screen.getByLabelText('US phone number')).toHaveValue('(713) 555-1234')
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('does not restore a draft typed by a different Google account', async () => {
    signInNewStudent()
    saveOnboardingDraft({ ...draftInput, ownerSub: 'someone-else' })
    renderApp('/signup')
    expect(await screen.findByLabelText('First name')).toHaveValue('')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('shows an error for an incorrect code, stays on the page, and registers nothing', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '000000')
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect code')
    expect(screen.getByTestId('path')).toHaveTextContent('/verify-phone')
    expect(fakeAccountApiCallCount('register')).toBe(0)
  })

  it('keeps Verify disabled until six digits are entered, with resend countdown and back link', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/verify-phone')
    expect(await screen.findByText(/Dev-only mock: no SMS is sent/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend \(\d+s\)/ })).toBeDisabled()
    expect(screen.getByLabelText('Back to signup')).toHaveAttribute('href', '/signup')
    await typeOtp(user, '123')
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
  })

  it('shows backend VALIDATION_FAILED messages on the matching form fields', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    queueFakeAccountResponse('register', {
      status: 400,
      body: {
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Please provide valid registration details.',
        fieldErrors: [{ field: 'phoneNumber', message: 'Enter a valid phone number in international format, e.g. +17135550101.' }],
        requestId: 'req-1'
      }
    })
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')

    expect(await screen.findByText(/international format/)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/signup')
    expect(screen.getByLabelText('First name')).toHaveValue('Ada') // draft kept for correction
  })

  it('shows NAME_ALREADY_REGISTERED without retrying automatically', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    queueFakeAccountResponse('register', {
      status: 409,
      body: {
        success: false,
        code: 'NAME_ALREADY_REGISTERED',
        message: 'An account with this name already exists. Please contact support.'
      }
    })
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')

    expect(await screen.findByText(/name already exists/)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/signup')
    expect(fakeAccountApiCallCount('register')).toBe(1)
  })

  it('shows a retryable error with the requestId after 503s, and "Try again" succeeds', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    const unavailable = {
      status: 503,
      body: { success: false, code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.', requestId: 'req-503' }
    }
    for (let i = 0; i < 4; i++) queueFakeAccountResponse('register', unavailable) // 1 try + 3 backoff retries
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')

    expect(await screen.findByText('Service temporarily unavailable.')).toBeInTheDocument()
    expect(screen.getByText('Reference: req-503')).toBeInTheDocument()
    expect(fakeAccountApiCallCount('register')).toBe(4)
    expect(readOnboardingDraft(NEW_SUB)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
  })

  it('sends one POST even when the user clicks repeatedly while it is in flight', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    updateOnboardingPhoneStep('dev-simulated', NEW_SUB) // e.g. page reloaded after the OTP step

    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const realImpl = fakeAccountFetch.getMockImplementation()!
    fakeAccountFetch.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/students/register')) await gate
      return realImpl(input, init)
    })

    renderApp('/verify-phone')
    const create = await screen.findByRole('button', { name: 'Create account' })
    await user.click(create)
    await user.click(create)
    await user.click(create)
    release()

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    expect(fakeAccountApiCallCount('register')).toBe(1)
  })

  it('follows GET /auth/me after 409 ACCOUNT_ALREADY_REGISTERED (e.g. a lost 201)', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    setFakeAccount(NEW_SUB, { type: 'registered' }) // registered in the meantime
    await typeOtp(user, '123456')

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    expect(readOnboardingDraft()).toBeNull()
  })

  it('shows the restricted screen (never the form) when registration is refused', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    queueFakeAccountResponse('register', {
      status: 403,
      body: { success: false, code: 'ACCOUNT_TYPE_MISMATCH', message: 'This Google identity belongs to a recruiter account.' }
    })
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')

    expect(await screen.findByRole('heading', { name: 'Not a student account' })).toBeInTheDocument()
    expect(screen.getByText(/recruiter account/)).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/account-status')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('lands on the pending screen when registration answers ACCOUNT_PENDING', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    queueFakeAccountResponse('register', {
      status: 201,
      body: {
        success: true,
        code: 'STUDENT_REGISTERED',
        data: {
          userId: 1, studentId: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@gmail.com',
          phoneNumber: '+17135551234', emailVerified: true, phoneVerified: false,
          accountStatus: 'PENDING', accountType: 'STUDENT', nextStep: 'ACCOUNT_PENDING'
        }
      }
    })
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')
    expect(await screen.findByRole('heading', { name: 'Account pending' })).toBeInTheDocument()
  })
})

describe('Session expiry during signup (contract §7)', () => {
  it('on 401 keeps the draft, asks for Continue with Google, and resumes the same form afterwards', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    queueFakeAccountResponse('register', { status: 401, body: { message: 'Unauthorized' } })
    const view = renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    await typeOtp(user, '123456')

    // Signed out locally; the draft survives; the reconnect screen offers Google.
    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readOnboardingDraft(NEW_SUB)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })

    // Back from Google with the same account: GET /auth/me → SIGNUP_FORM → draft restored.
    view.unmount()
    signInNewStudent()
    renderApp('/')
    expect(await screen.findByLabelText('First name')).toHaveValue('Ada')
  })

  it('treats a missing access token like 401 (no request is made)', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    setFakeCognitoUser(null) // refresh token expired: Amplify holds no tokens
    await typeOtp(user, '123456')

    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument()
    expect(fakeAccountApiCallCount('register')).toBe(0)
    expect(readOnboardingDraft(NEW_SUB)).not.toBeNull()
  })
})

describe('Refresh and logout', () => {
  it('a full page refresh re-runs GET /auth/me and resumes the OTP step', async () => {
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    const first = renderApp('/verify-phone')
    await screen.findByText('Verify Your Phone')
    const lookups = fakeAccountApiCallCount('lookup')
    first.unmount()

    renderApp('/verify-phone') // fresh providers = reloaded tab (sessionStorage survives)
    expect(await screen.findByText('Verify Your Phone')).toBeInTheDocument()
    expect(fakeAccountApiCallCount('lookup')).toBe(lookups + 1)
  })

  it('a refresh never trusts a stale "registered" state: a now-suspended student is kept out', async () => {
    setFakeCognitoUser({ sub: 'student-1' })
    const first = renderApp('/student/dashboard')
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    first.unmount()

    queueFakeAccountResponse('lookup', {
      status: 403,
      body: { success: false, code: 'ACCOUNT_SUSPENDED', message: 'Your account is currently suspended.' }
    })
    renderApp('/student/dashboard')
    expect(await screen.findByRole('heading', { name: 'Account suspended' })).toBeInTheDocument()
  })

  it('"Use a different Google account" on the form signs out and clears the draft', async () => {
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/signup')
    await user.click(await screen.findByRole('button', { name: /use a different google account/i }))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readOnboardingDraft()).toBeNull()
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('signs out of Cognito from the profile page and protected pages become inaccessible', async () => {
    const user = userEvent.setup()
    setFakeCognitoUser({ sub: 'sub-1' })
    renderApp('/student/profile')
    await user.click(await screen.findByRole('button', { name: /sign out/i }))
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/login')
  })
})

describe('Production build', () => {
  it('never offers the mock OTP; Continue registers with the phone explicitly unverified', async () => {
    vi.stubEnv('DEV', false)
    const user = userEvent.setup()
    signInNewStudent()
    saveOnboardingDraft(draftInput)
    renderApp('/verify-phone')

    expect(await screen.findByText(/SMS verification isn’t available yet/)).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/^Digit \d$/)).toHaveLength(0)
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    expect(registerCalls()[0]!.body).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+17135551234',
      acceptedTerms: true
    })
  })
})

describe('Existing student: Google → Dashboard', () => {
  it('a signed-in registered student goes straight to the dashboard (no signup, no register call)', async () => {
    setFakeCognitoUser({ sub: 'student-1' })
    renderApp('/login')
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/student/dashboard'))
    expect(fakeAccountApiCallCount('register')).toBe(0)
  })

  it('Continue with Google starts Cognito sign-in once and remembers the requested page', async () => {
    const user = userEvent.setup()
    renderApp('/student/applications')
    const button = await screen.findByRole('button', { name: /continue with google/i })
    await user.click(button)
    await user.click(button)
    expect(signInWithRedirect).toHaveBeenCalledTimes(1)
    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })
    expect(readRedirectIntent()).toMatchObject({ flow: 'login', returnTo: '/student/applications' })
  })

  it('"Sign Up" uses the same Google sign-in (one button for new and returning students)', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(await screen.findByRole('button', { name: 'Sign Up' }))
    expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })
    expect(readRedirectIntent()).toMatchObject({ flow: 'signup' })
  })

  it('shows a useful error and re-enables the button when sign-in cannot start', async () => {
    const user = userEvent.setup()
    signInWithRedirect.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NetworkError' }))
    renderApp('/login')
    const button = await screen.findByRole('button', { name: /continue with google/i })
    await user.click(button)
    expect(await screen.findByText(/couldn’t reach the sign-in service/i)).toBeInTheDocument()
    await waitFor(() => expect(button).toBeEnabled())
    expect(readRedirectIntent()).toBeNull()
  })

  it('shows an actionable configuration error on a callback URL mismatch', async () => {
    vi.stubEnv('VITE_COGNITO_REDIRECT_URL', 'https://somewhere-else.example/auth/callback')
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(await screen.findByRole('button', { name: /continue with google/i }))
    expect(await screen.findByText(/isn’t configured for this web address/i)).toBeInTheDocument()
    expect(signInWithRedirect).not.toHaveBeenCalled()
  })

  it('never creates a fake session without Google', async () => {
    renderApp('/login')
    await screen.findByRole('button', { name: /continue with google/i })
    expect(window.localStorage.getItem('hmb.mock.user')).toBeNull()
  })
})
