import { describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Hub } from 'aws-amplify/utils'
import { AuthProvider, useAuth } from '../AuthProvider'
import { readOnboardingDraft, saveOnboardingDraft } from '../services/onboardingDraft'
import { readRedirectIntent, saveRedirectIntent } from '../services/redirectIntent'
import { FAKE_ACCESS_TOKEN, fetchAuthSession, setFakeCognitoUser, signOut } from '@/test/fakeAmplifyAuth'
import {
  fakeAccountApiCallCount,
  queueFakeAccountResponse,
  setFakeAccount
} from '@/test/fakeStudentAccountApi'

const AMPLIFY_SYMBOL = Symbol.for('amplify_default')

let ctx: ReturnType<typeof useAuth>

function Probe() {
  ctx = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(ctx.isLoading)}</span>
      <span data-testid="authed">{String(ctx.isAuthenticated)}</span>
      <span data-testid="email">{ctx.user?.email ?? ''}</span>
      <span data-testid="error">{ctx.error?.code ?? ''}</span>
      <span data-testid="account">{ctx.account.status}</span>
    </div>
  )
}

function renderProvider() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('AuthProvider (Cognito)', () => {
  it('starts loading, then restores an existing Cognito session', async () => {
    setFakeCognitoUser({ sub: 'sub-1', email: 'ada@example.com' })
    renderProvider()
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com')
    expect(document.body.textContent).not.toContain(FAKE_ACCESS_TOKEN)
  })

  it('treats a missing session as signed out', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
  })

  it('treats an unverifiable session (network failure) as signed out and records the error', async () => {
    fetchAuthSession.mockRejectedValue(new TypeError('Failed to fetch'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('NETWORK')
  })

  it('logout signs out of Cognito and clears auth state, onboarding draft, and redirect intent', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    saveOnboardingDraft({ ownerSub: 'sub-1', firstName: 'A', lastName: 'B', phoneE164: '+17135551234', acceptedTerms: true })
    saveRedirectIntent('login', '/student/dashboard')
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))

    await act(async () => {
      await ctx.logout()
    })

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(readOnboardingDraft()).toBeNull()
    expect(readRedirectIntent()).toBeNull()
  })

  it('logout still clears local state if the Cognito call fails', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    signOut.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))
    await act(async () => {
      await ctx.logout()
    })
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('NETWORK')
  })

  it('drops the user when Amplify reports the refresh token expired', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'))

    // Amplify clears tokens on an auth failure, then emits tokenRefresh_failure.
    setFakeCognitoUser(null)
    act(() => {
      Hub.dispatch('auth', { event: 'tokenRefresh_failure' }, 'Auth', AMPLIFY_SYMBOL)
    })
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'))
  })

  it('reacts to Amplify sign-in and sign-out events', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    setFakeCognitoUser({ sub: 'sub-2', email: 'late@example.com' })
    act(() => {
      Hub.dispatch('auth', { event: 'signInWithRedirect' }, 'Auth', AMPLIFY_SYMBOL)
    })
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('late@example.com'))

    act(() => {
      Hub.dispatch('auth', { event: 'signedOut' }, 'Auth', AMPLIFY_SYMBOL)
    })
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'))
  })
})

const draft = (ownerSub: string) => ({
  ownerSub,
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneE164: '+17135551234',
  acceptedTerms: true
})
const registration = { firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '+17135551234', acceptedTerms: true as const }

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('AuthProvider (backend account state)', () => {
  it('runs GET /auth/me on app start and stays loading until it answers', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderProvider()
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('account')).toHaveTextContent('active')
    expect(fakeAccountApiCallCount('lookup')).toBe(1)
  })

  it('does not call the backend when there is no Cognito session', async () => {
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('account')).toHaveTextContent('none')
    expect(fakeAccountApiCallCount('lookup')).toBe(0)
  })

  it('reports SIGNUP_FORM as an unregistered account (the lookup creates nothing)', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('unregistered'))
    expect(fakeAccountApiCallCount('register')).toBe(0)
  })

  it('on 401 from /auth/me signs out locally but keeps the signup draft', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    saveOnboardingDraft(draft('sub-1'))
    queueFakeAccountResponse('lookup', { status: 401, body: { message: 'Unauthorized' } })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(screen.getByTestId('account')).toHaveTextContent('none')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readOnboardingDraft('sub-1')).not.toBeNull()
  })

  it('applies a suspension on the next lookup (returning to the tab)', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('active'))

    queueFakeAccountResponse('lookup', {
      status: 403,
      body: { success: false, code: 'ACCOUNT_SUSPENDED', message: 'Your account is currently suspended.' }
    })
    act(() => setVisibility('visible'))
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('restricted'))
  })

  it('keeps the last known account if a background re-check fails temporarily', async () => {
    setFakeCognitoUser({ sub: 'sub-1' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('active'))

    for (let i = 0; i < 4; i++) queueFakeAccountResponse('lookup', { networkError: true })
    const before = fakeAccountApiCallCount('lookup')
    act(() => setVisibility('visible'))
    await waitFor(() => expect(fakeAccountApiCallCount('lookup')).toBe(before + 4))
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByTestId('account')).toHaveTextContent('active')
  })

  it('re-evaluates the account when a different Google identity signs in', async () => {
    setFakeCognitoUser({ sub: 'student', email: 'a@gmail.com' })
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('active'))

    setFakeCognitoUser({ sub: 'newcomer', email: 'b@gmail.com' })
    setFakeAccount('newcomer', { type: 'unregistered' })
    act(() => {
      Hub.dispatch('auth', { event: 'signedIn' }, 'Auth', AMPLIFY_SYMBOL)
    })
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('b@gmail.com'))
    expect(screen.getByTestId('account')).toHaveTextContent('unregistered')
  })

  it('shares one in-flight POST between concurrent registerStudent calls', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draft('new'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('unregistered'))

    let results: unknown[] = []
    await act(async () => {
      results = await Promise.all([ctx.registerStudent(registration), ctx.registerStudent(registration)])
    })
    expect(fakeAccountApiCallCount('register')).toBe(1)
    expect(results[0]).toBe(results[1])
    expect(screen.getByTestId('account')).toHaveTextContent('active')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('on 409 ACCOUNT_ALREADY_REGISTERED re-runs GET /auth/me and follows it', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draft('new'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('unregistered'))

    // e.g. the first 201 was lost: the account exists now.
    setFakeAccount('new', { type: 'registered' })
    const lookupsBefore = fakeAccountApiCallCount('lookup')
    let result: Awaited<ReturnType<typeof ctx.registerStudent>> | undefined
    await act(async () => {
      result = await ctx.registerStudent(registration)
    })
    expect(result?.status).toBe('active')
    expect(fakeAccountApiCallCount('lookup')).toBe(lookupsBefore + 1)
    expect(readOnboardingDraft()).toBeNull()
  })

  it('on a restriction during registration clears the draft and reports it', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draft('new'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('unregistered'))

    queueFakeAccountResponse('register', {
      status: 409,
      body: {
        success: false,
        code: 'ACCOUNT_IDENTITY_CONFLICT',
        message: 'An existing account requires a different sign-in or account recovery method.'
      }
    })
    await act(async () => {
      await ctx.registerStudent(registration)
    })
    expect(screen.getByTestId('account')).toHaveTextContent('restricted')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('on 401 during registration ends the session and keeps the draft', async () => {
    setFakeCognitoUser({ sub: 'new' })
    setFakeAccount('new', { type: 'unregistered' })
    saveOnboardingDraft(draft('new'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('unregistered'))

    queueFakeAccountResponse('register', { status: 401, body: { success: false, code: 'UNAUTHORIZED', message: 'x' } })
    await act(async () => {
      await expect(ctx.registerStudent(registration)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(readOnboardingDraft('new')).not.toBeNull()
  })
})
