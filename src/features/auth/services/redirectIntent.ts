import type { SignInFlow } from '../types'

/**
 * Remembers *why* the user left for Google so /auth/callback can route them
 * back to the right place after the full-page OAuth round trip.
 *
 * Stored in sessionStorage (tab-scoped) and holds only a flow name and an
 * app-relative path — never tokens or personal data.
 */
const KEY = 'hmb.auth.redirectIntent'
/** An OAuth round trip that takes longer than this is treated as abandoned. */
export const REDIRECT_INTENT_TTL_MS = 15 * 60 * 1000

export type RedirectIntent = {
  flow: SignInFlow
  /** Validated in-app path to resume after login, e.g. `/student/applications`. */
  returnTo: string | null
  createdAt: number
}

/**
 * Only protected student pages are valid resume targets. This also blocks
 * open redirects (`//evil.example`, `https://…`, `/\evil`) and auth routes
 * that would loop.
 */
export function isSafeReturnPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  if (!/^\/student(\/|$|\?)/.test(path)) return false
  return !/[\\\s]/.test(path) && !path.includes('//') && !path.includes('..')
}

export function saveRedirectIntent(flow: SignInFlow, returnTo?: string | null): void {
  const intent: RedirectIntent = {
    flow,
    returnTo: isSafeReturnPath(returnTo) ? returnTo : null,
    createdAt: Date.now()
  }
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(intent))
  } catch {
    // Storage unavailable (private mode quota, etc.) — fall back to defaults.
  }
}

export function readRedirectIntent(): RedirectIntent | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RedirectIntent>
    const valid =
      (parsed.flow === 'login' || parsed.flow === 'signup') &&
      typeof parsed.createdAt === 'number' &&
      Date.now() - parsed.createdAt <= REDIRECT_INTENT_TTL_MS
    if (!valid) {
      clearRedirectIntent()
      return null
    }
    return {
      flow: parsed.flow as SignInFlow,
      returnTo: isSafeReturnPath(parsed.returnTo) ? parsed.returnTo : null,
      createdAt: parsed.createdAt as number
    }
  } catch {
    clearRedirectIntent()
    return null
  }
}

export function clearRedirectIntent(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
