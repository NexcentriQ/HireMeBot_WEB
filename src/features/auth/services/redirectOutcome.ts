import { Hub } from 'aws-amplify/utils'

/**
 * Records the outcome of Amplify's OAuth redirect completion.
 *
 * Amplify finishes the Authorization Code + PKCE exchange from a module-level
 * listener as soon as `Amplify.configure()` runs — often before React has
 * mounted the /auth/callback page. A Hub event dispatched before the page
 * subscribes would be lost, so this recorder is started *before*
 * `Amplify.configure()` and keeps the last outcome for late subscribers.
 */
export type RedirectOutcome = { type: 'success' } | { type: 'failure'; error: unknown }
export type RedirectOutcomeOrTimeout = RedirectOutcome | { type: 'timeout' }

let lastOutcome: RedirectOutcome | null = null
const subscribers = new Set<(outcome: RedirectOutcome) => void>()
let stopListening: (() => void) | null = null

function record(outcome: RedirectOutcome) {
  lastOutcome = outcome
  for (const notify of [...subscribers]) notify(outcome)
}

export function startRedirectOutcomeRecorder(): void {
  if (stopListening) return
  stopListening = Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'signInWithRedirect') {
      record({ type: 'success' })
    } else if (payload.event === 'signInWithRedirect_failure') {
      record({ type: 'failure', error: payload.data?.error })
    }
  })
}

export function getLastRedirectOutcome(): RedirectOutcome | null {
  return lastOutcome
}

/** Resolves with the recorded outcome, the next one, or `timeout`. */
export function waitForRedirectOutcome(timeoutMs: number): Promise<RedirectOutcomeOrTimeout> {
  if (lastOutcome) return Promise.resolve(lastOutcome)
  return new Promise((resolve) => {
    const onOutcome = (outcome: RedirectOutcome) => {
      window.clearTimeout(timer)
      subscribers.delete(onOutcome)
      resolve(outcome)
    }
    const timer = window.setTimeout(() => {
      subscribers.delete(onOutcome)
      resolve({ type: 'timeout' })
    }, timeoutMs)
    subscribers.add(onOutcome)
  })
}

/** Test helper — detaches the Hub listener and forgets any recorded outcome. */
export function resetRedirectOutcomeRecorder(): void {
  stopListening?.()
  stopListening = null
  lastOutcome = null
  subscribers.clear()
}
