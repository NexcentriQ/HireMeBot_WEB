import { vi } from 'vitest'

/**
 * In-memory stand-in for `aws-amplify/auth`, installed for every test file by
 * src/test/setup.ts. Tests drive the "Cognito session" with
 * `setFakeCognitoUser()` and assert on the exported `vi.fn` spies.
 *
 * Token strings are obviously fake so tests can assert they never leak into
 * the DOM or logs.
 */
export type FakeCognitoUser = {
  sub: string
  username?: string
  email?: string
  emailVerified?: boolean | string
  givenName?: string
  familyName?: string
  providerName?: string
}

export const FAKE_ACCESS_TOKEN = 'fake-access-token.do-not-render'
export const FAKE_ID_TOKEN = 'fake-id-token.do-not-render'

let currentUser: FakeCognitoUser | null = null

export function setFakeCognitoUser(user: FakeCognitoUser | null) {
  currentUser = user
}

export function getFakeCognitoUser(): FakeCognitoUser | null {
  return currentUser
}

function unauthenticated() {
  return Object.assign(new Error('User needs to be authenticated to call this API.'), {
    name: 'UserUnAuthenticatedException'
  })
}

function idTokenPayload(user: FakeCognitoUser): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    sub: user.sub,
    'cognito:username': user.username ?? `google_${user.sub}`,
    identities: [{ providerName: user.providerName ?? 'Google', userId: `g-${user.sub}` }]
  }
  if (user.email !== undefined) payload.email = user.email
  if (user.emailVerified !== undefined) payload.email_verified = user.emailVerified
  if (user.givenName !== undefined) payload.given_name = user.givenName
  if (user.familyName !== undefined) payload.family_name = user.familyName
  return payload
}

export const signInWithRedirect = vi.fn()
export const getCurrentUser = vi.fn()
export const fetchAuthSession = vi.fn()
export const signOut = vi.fn()

export function resetFakeAmplifyAuth() {
  currentUser = null
  signInWithRedirect.mockReset().mockImplementation(async () => {})
  getCurrentUser.mockReset().mockImplementation(async () => {
    if (!currentUser) throw unauthenticated()
    return { userId: currentUser.sub, username: currentUser.username ?? `google_${currentUser.sub}` }
  })
  fetchAuthSession.mockReset().mockImplementation(async () => {
    if (!currentUser) return { tokens: undefined }
    const payload = idTokenPayload(currentUser)
    return {
      tokens: {
        idToken: { payload, toString: () => FAKE_ID_TOKEN },
        accessToken: { payload: { sub: currentUser.sub }, toString: () => FAKE_ACCESS_TOKEN }
      }
    }
  })
  signOut.mockReset().mockImplementation(async () => {
    currentUser = null
  })
}

resetFakeAmplifyAuth()
