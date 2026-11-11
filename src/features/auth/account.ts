import type {
  AccountApiError,
  AccountLookupResult,
  RestrictionCode,
  StudentAccount,
  StudentRegistrationResult
} from './services/studentAccountApi'

/**
 * What HireMeBot's backend says about the signed-in Cognito identity.
 *
 * Held in memory only (React state), re-derived from `GET /auth/me` on every
 * app start and every Google sign-in. Never persisted: a stored
 * "registered"/"isAuthenticated" flag could outlive a suspension.
 */
export type AccountState =
  /** No Cognito session (or the lookup hasn't run). */
  | { status: 'none' }
  /** `nextStep: DASHBOARD` — registered, active student. */
  | { status: 'active'; student: StudentAccount }
  /** `nextStep: ACCOUNT_PENDING`. */
  | { status: 'pending'; student: StudentAccount }
  /** `nextStep: SIGNUP_FORM` — Google identity, not a HireMeBot student yet. */
  | { status: 'unregistered' }
  /** 403 restriction or 409 identity conflict — never the signup form. */
  | { status: 'restricted'; code: RestrictionCode; message: string; requestId: string | null }
  /** 5xx / network / unexpected response after retries. Retryable. */
  | { status: 'error'; message: string; requestId: string | null }

export type AccountStatus = AccountState['status']

export const NO_ACCOUNT: AccountState = { status: 'none' }

export function accountFromLookup(result: AccountLookupResult): AccountState {
  if (!result.registered) return { status: 'unregistered' }
  return result.nextStep === 'DASHBOARD'
    ? { status: 'active', student: result.user }
    : { status: 'pending', student: result.user }
}

export function accountFromRegistration(result: StudentRegistrationResult): AccountState {
  return result.nextStep === 'DASHBOARD'
    ? { status: 'active', student: result.student }
    : { status: 'pending', student: result.student }
}

/** Maps a non-auth lookup failure to a screen state. (401s are handled by the caller.) */
export function accountFromError(err: AccountApiError): AccountState {
  if (err.isRestriction) {
    return { status: 'restricted', code: err.code as RestrictionCode, message: err.message, requestId: err.requestId }
  }
  return { status: 'error', message: err.message, requestId: err.requestId }
}

/**
 * The backend `studentId` of the signed-in, ACTIVE student (from
 * `GET /auth/me` or registration), or `undefined` when there isn't one.
 * Student API calls and their cache keys are scoped by this id.
 */
export function studentIdFromAccount(account: AccountState): number | undefined {
  if (account.status !== 'active') return undefined
  const { studentId } = account.student
  return Number.isFinite(studentId) ? studentId : undefined
}

export const DASHBOARD_PATH = '/student/dashboard'
export const SIGNUP_PATH = '/signup'
export const ACCOUNT_STATUS_PATH = '/account-status'
export const LOGIN_PATH = '/login'

/**
 * The single source of truth for "where does this account belong?".
 * Used by the OAuth callback, every guard, and the registration screen.
 */
export function routeForAccount(account: AccountState, returnTo?: string | null): string {
  switch (account.status) {
    case 'active':
      return returnTo ?? DASHBOARD_PATH
    case 'unregistered':
      return SIGNUP_PATH
    case 'pending':
    case 'restricted':
    case 'error':
      return ACCOUNT_STATUS_PATH
    case 'none':
      return LOGIN_PATH
  }
}
