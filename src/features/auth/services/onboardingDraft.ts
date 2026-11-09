/**
 * Short-lived, tab-scoped record of what the student typed on the signup
 * form, so the OTP screen can submit it and so it survives a Hosted UI
 * redirect when the session has to be renewed mid-signup
 * (STUDENT_AUTH_API.md §6–7).
 *
 * Rules:
 * - sessionStorage only (cleared when the tab closes) plus a hard TTL, so an
 *   abandoned signup does not linger.
 * - Cleared on registration success, conflict, restriction, and sign-out.
 *   Kept on UNAUTHORIZED so the user can resume after Continue with Google.
 * - Holds no credentials or tokens. `ownerSub` (the Cognito `sub`, not a
 *   secret) binds the draft to the identity that typed it: if the user comes
 *   back with a different Google account the draft is discarded.
 * - `phoneStep` tracks UI progress only. It is NOT a verification claim and
 *   is never sent to the backend.
 */
const KEY = 'hmb.onboarding.draft'
export const ONBOARDING_DRAFT_TTL_MS = 30 * 60 * 1000

/**
 * - `pending`       — Create Account submitted; phone step not finished.
 * - `dev-simulated` — development mock OTP accepted (NOT a real verification).
 * - `deferred`      — SMS verification unavailable in this build; the user
 *                      continued without it. The phone remains unverified.
 */
export type PhoneStep = 'pending' | 'dev-simulated' | 'deferred'

export type OnboardingDraft = {
  version: 2
  /** Cognito `sub` of the identity that filled in the form. */
  ownerSub: string
  firstName: string
  lastName: string
  phoneE164: string
  acceptedTerms: true
  phoneStep: PhoneStep
  createdAt: number
}

export type OnboardingDraftInput = {
  ownerSub: string
  firstName: string
  lastName: string
  phoneE164: string
  acceptedTerms: boolean
}

const PHONE_STEPS: readonly PhoneStep[] = ['pending', 'dev-simulated', 'deferred']

function isDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as Record<string, unknown>
  return (
    d.version === 2 &&
    typeof d.ownerSub === 'string' &&
    d.ownerSub !== '' &&
    typeof d.firstName === 'string' &&
    typeof d.lastName === 'string' &&
    typeof d.phoneE164 === 'string' &&
    /^\+[1-9]\d{6,14}$/.test(d.phoneE164) &&
    d.acceptedTerms === true &&
    PHONE_STEPS.includes(d.phoneStep as PhoneStep) &&
    typeof d.createdAt === 'number'
  )
}

function write(draft: OnboardingDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Storage unavailable: the guards send the user back to /signup.
  }
}

export function saveOnboardingDraft(input: OnboardingDraftInput): OnboardingDraft {
  if (!input.acceptedTerms) {
    throw new Error('Terms must be accepted before continuing.')
  }
  const draft: OnboardingDraft = {
    version: 2,
    ownerSub: input.ownerSub,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phoneE164: input.phoneE164,
    acceptedTerms: true,
    // Any (re)submission of Create Account restarts the phone step.
    phoneStep: 'pending',
    createdAt: Date.now()
  }
  write(draft)
  return draft
}

/**
 * Returns the current draft. Pass the signed-in user's `sub` whenever it is
 * known: a draft written by a different identity is discarded.
 */
export function readOnboardingDraft(ownerSub?: string): OnboardingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !isDraft(parsed) ||
      Date.now() - parsed.createdAt > ONBOARDING_DRAFT_TTL_MS ||
      (ownerSub !== undefined && parsed.ownerSub !== ownerSub)
    ) {
      clearOnboardingDraft()
      return null
    }
    return parsed
  } catch {
    clearOnboardingDraft()
    return null
  }
}

export function updateOnboardingPhoneStep(phoneStep: PhoneStep, ownerSub?: string): OnboardingDraft | null {
  const current = readOnboardingDraft(ownerSub)
  if (!current) return null
  const next: OnboardingDraft = { ...current, phoneStep }
  write(next)
  return next
}

export function clearOnboardingDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/**
 * The previous MockAuthService kept a fake session and a `phoneVerified: true`
 * registration in localStorage. Remove those so stale mock state can never be
 * mistaken for a real session or a verified phone.
 */
export function purgeLegacyMockAuthStorage(): void {
  try {
    for (const key of ['hmb.mock.pendingRegistration', 'hmb.mock.user', 'hmb.mock.lastResend']) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}
