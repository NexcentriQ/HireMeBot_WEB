import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hub } from 'aws-amplify/utils'
import {
  completeRedirectSignIn,
  getAccessToken,
  getAuthenticatedUser,
  getIdToken,
  isAuthenticated,
  loginWithGoogle,
  logout
} from '../services/authService'
import { toAuthServiceError } from '../services/authErrors'
import { resetRedirectOutcomeRecorder, startRedirectOutcomeRecorder } from '../services/redirectOutcome'
import { isSafeReturnPath, readRedirectIntent, saveRedirectIntent } from '../services/redirectIntent'
import {
  FAKE_ACCESS_TOKEN,
  FAKE_ID_TOKEN,
  fetchAuthSession,
  getCurrentUser,
  setFakeCognitoUser,
  signInWithRedirect,
  signOut
} from '@/test/fakeAmplifyAuth'

const AMPLIFY_SYMBOL = Symbol.for('amplify_default')

function named(name: string, message = name) {
  return Object.assign(new Error(message), { name })
}

describe('authService (Cognito via Amplify)', () => {
  describe('loginWithGoogle', () => {
    it('starts the Cognito Google redirect', async () => {
      await loginWithGoogle()
      expect(signInWithRedirect).toHaveBeenCalledTimes(1)
      expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' })
    })

    it('refuses to start when Cognito env vars are missing', async () => {
      vi.stubEnv('VITE_COGNITO_CLIENT_ID', '')
      await expect(loginWithGoogle()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
      expect(signInWithRedirect).not.toHaveBeenCalled()
    })

    it('reports an actionable error when the callback URL origin does not match the app', async () => {
      vi.stubEnv('VITE_COGNITO_REDIRECT_URL', 'http://localhost:5173/auth/callback')
      const err = await loginWithGoogle().catch((e) => e)
      expect(err).toMatchObject({ code: 'REDIRECT_MISMATCH' })
      expect(err.message).toMatch(/localhost:3000/)
      expect(err.message).toMatch(/VITE_COGNITO_REDIRECT_URL/)
      expect(signInWithRedirect).not.toHaveBeenCalled()
    })

    it('maps "already signed in" so callers can resume instead of failing', async () => {
      signInWithRedirect.mockRejectedValueOnce(named('UserAlreadyAuthenticatedException'))
      await expect(loginWithGoogle()).rejects.toMatchObject({ code: 'ALREADY_SIGNED_IN' })
    })
  })

  describe('session', () => {
    it('returns null and no tokens when signed out', async () => {
      expect(await getAuthenticatedUser()).toBeNull()
      expect(await isAuthenticated()).toBe(false)
      expect(await getAccessToken()).toBeNull()
      expect(await getIdToken()).toBeNull()
    })

    it('maps ID token claims, using the Cognito sub as the user id', async () => {
      setFakeCognitoUser({
        sub: 'sub-123',
        username: 'google_987',
        email: 'ada@example.com',
        emailVerified: 'true',
        givenName: 'Ada',
        familyName: 'Lovelace'
      })
      expect(await getAuthenticatedUser()).toEqual({
        userId: 'sub-123',
        username: 'google_987',
        email: 'ada@example.com',
        emailVerified: true,
        givenName: 'Ada',
        familyName: 'Lovelace',
        identityProvider: 'Google'
      })
      expect(await isAuthenticated()).toBe(true)
      expect(await getAccessToken()).toBe(FAKE_ACCESS_TOKEN)
      expect(await getIdToken()).toBe(FAKE_ID_TOKEN)
    })

    it('never exposes tokens on the user object', async () => {
      setFakeCognitoUser({ sub: 'sub-123' })
      const user = await getAuthenticatedUser()
      const serialized = JSON.stringify(user)
      expect(serialized).not.toContain(FAKE_ACCESS_TOKEN)
      expect(serialized).not.toContain(FAKE_ID_TOKEN)
    })

    it('does not treat a session with missing tokens as authenticated', async () => {
      setFakeCognitoUser({ sub: 'sub-123' })
      fetchAuthSession.mockResolvedValueOnce({ tokens: { idToken: undefined, accessToken: undefined } })
      expect(await getAuthenticatedUser()).toBeNull()
    })

    it('surfaces network failures as retryable errors', async () => {
      fetchAuthSession.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      await expect(getAuthenticatedUser()).rejects.toMatchObject({ code: 'NETWORK' })
    })
  })

  it('logout signs out of Cognito', async () => {
    setFakeCognitoUser({ sub: 'sub-123' })
    await logout()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(await getAuthenticatedUser()).toBeNull()
  })

  describe('completeRedirectSignIn', () => {
    beforeEach(() => startRedirectOutcomeRecorder())
    afterEach(() => resetRedirectOutcomeRecorder())

    it('returns an already-established session', async () => {
      setFakeCognitoUser({ sub: 'sub-1' })
      await expect(completeRedirectSignIn({ search: '' })).resolves.toMatchObject({ userId: 'sub-1' })
    })

    it('treats access_denied on the callback URL as a cancellation', async () => {
      await expect(
        completeRedirectSignIn({ search: '?error=access_denied&error_description=User+cancelled' })
      ).rejects.toMatchObject({ code: 'GOOGLE_CANCELLED' })
    })

    it('reports other IdP errors as a sign-in failure', async () => {
      await expect(
        completeRedirectSignIn({ search: '?error=invalid_request&error_description=unauthorized_client' })
      ).rejects.toMatchObject({ code: 'GOOGLE_SIGN_IN_FAILED' })
    })

    it('waits for Amplify to finish an in-flight exchange instead of failing early', async () => {
      // Amplify parks getCurrentUser/fetchAuthSession until the code exchange settles.
      let release!: () => void
      const exchange = new Promise<void>((r) => (release = r))
      fetchAuthSession.mockImplementationOnce(async () => {
        await exchange
        setFakeCognitoUser({ sub: 'sub-late' })
        return {
          tokens: {
            idToken: { payload: { sub: 'sub-late' }, toString: () => FAKE_ID_TOKEN },
            accessToken: { payload: {}, toString: () => FAKE_ACCESS_TOKEN }
          }
        }
      })
      let settled = false
      const pending = completeRedirectSignIn({ search: '?code=abc&state=xyz' }).finally(() => (settled = true))
      await new Promise((r) => setTimeout(r, 20))
      expect(settled).toBe(false)
      release()
      await expect(pending).resolves.toMatchObject({ userId: 'sub-late' })
      expect(getCurrentUser).toHaveBeenCalled()
    })

    it('uses the Hub failure event when the code exchange fails', async () => {
      const pending = completeRedirectSignIn({ search: '?code=abc&state=xyz', timeoutMs: 2000 })
      Hub.dispatch(
        'auth',
        { event: 'signInWithRedirect_failure', data: { error: named('OAuthSignInException', 'invalid_grant') } },
        'Auth',
        AMPLIFY_SYMBOL
      )
      await expect(pending).rejects.toMatchObject({ code: 'GOOGLE_SIGN_IN_FAILED' })
    })

    it('reports a network failure during the exchange as retryable', async () => {
      Hub.dispatch(
        'auth',
        { event: 'signInWithRedirect_failure', data: { error: new TypeError('Failed to fetch') } },
        'Auth',
        AMPLIFY_SYMBOL
      )
      await expect(completeRedirectSignIn({ search: '?code=abc&state=xyz' })).rejects.toMatchObject({
        code: 'NETWORK'
      })
    })

    it('fails cleanly when no sign-in is in progress', async () => {
      await expect(completeRedirectSignIn({ search: '' })).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE' })
    })
  })
})

describe('error mapping', () => {
  it.each([
    ['InvalidRedirectException', 'REDIRECT_MISMATCH'],
    ['InvalidOriginException', 'REDIRECT_MISMATCH'],
    ['AuthUserPoolException', 'NOT_CONFIGURED'],
    ['UserUnAuthenticatedException', 'SESSION_UNAVAILABLE'],
    ['NetworkError', 'NETWORK'],
    ['SomethingElse', 'UNKNOWN']
  ])('%s → %s', (name, code) => {
    expect(toAuthServiceError(named(name)).code).toBe(code)
  })

  it('maps an Amplify OAuth cancellation to GOOGLE_CANCELLED', () => {
    expect(toAuthServiceError(named('OAuthSignInException', 'User cancelled OAuth flow.')).code).toBe(
      'GOOGLE_CANCELLED'
    )
  })

  it('hides raw SDK details from production users', () => {
    vi.stubEnv('DEV', false)
    const err = toAuthServiceError(named('OAuthSignInException', 'invalid_grant: internal detail'))
    expect(err.message).not.toContain('internal detail')
  })
})

describe('redirect intent', () => {
  it.each([
    ['/student/dashboard', true],
    ['/student/applications/42?tab=x', true],
    ['/student', true],
    ['//evil.example/student', false],
    ['https://evil.example/student', false],
    ['/login', false],
    ['/auth/callback', false],
    ['/student/../login', false],
    ['/student\\evil', false]
  ])('isSafeReturnPath(%j) === %s', (path, expected) => {
    expect(isSafeReturnPath(path)).toBe(expected)
  })

  it('drops unsafe return paths when saving', () => {
    saveRedirectIntent('login', 'https://evil.example')
    expect(readRedirectIntent()).toMatchObject({ flow: 'login', returnTo: null })
  })
})
