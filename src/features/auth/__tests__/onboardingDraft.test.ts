import { describe, expect, it, vi } from 'vitest'
import {
  clearOnboardingDraft,
  ONBOARDING_DRAFT_TTL_MS,
  purgeLegacyMockAuthStorage,
  readOnboardingDraft,
  saveOnboardingDraft,
  updateOnboardingPhoneStep
} from '../services/onboardingDraft'

const input = { ownerSub: 'sub-1', firstName: '  Ada ', lastName: 'Lovelace', phoneE164: '+17135551234', acceptedTerms: true }

describe('onboarding draft', () => {
  it('stores trimmed form data in sessionStorage (not localStorage) with a pending phone step', () => {
    const draft = saveOnboardingDraft(input)
    expect(draft).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneE164: '+17135551234',
      acceptedTerms: true,
      phoneStep: 'pending'
    })
    expect(window.sessionStorage.getItem('hmb.onboarding.draft')).not.toBeNull()
    expect(window.localStorage.length).toBe(0)
    expect(readOnboardingDraft()).toEqual(draft)
  })

  it('holds no tokens, credentials, or verification claims', () => {
    saveOnboardingDraft(input)
    const raw = window.sessionStorage.getItem('hmb.onboarding.draft') ?? ''
    expect(raw).not.toMatch(/token|password|secret|verified|otp/i)
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(
      ['acceptedTerms', 'createdAt', 'firstName', 'lastName', 'ownerSub', 'phoneE164', 'phoneStep', 'version'].sort()
    )
  })

  it('is bound to the Google identity that wrote it (account switching discards it)', () => {
    saveOnboardingDraft(input)
    expect(readOnboardingDraft('sub-1')?.firstName).toBe('Ada')
    expect(readOnboardingDraft('someone-else')).toBeNull()
    // Discarded for good, not just hidden.
    expect(readOnboardingDraft()).toBeNull()
  })

  it('requires accepted terms', () => {
    expect(() => saveOnboardingDraft({ ...input, acceptedTerms: false })).toThrow()
    expect(readOnboardingDraft()).toBeNull()
  })

  it('expires abandoned drafts', () => {
    vi.useFakeTimers()
    try {
      saveOnboardingDraft(input)
      vi.advanceTimersByTime(ONBOARDING_DRAFT_TTL_MS + 1)
      expect(readOnboardingDraft()).toBeNull()
      expect(window.sessionStorage.getItem('hmb.onboarding.draft')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('discards malformed or tampered data', () => {
    window.sessionStorage.setItem('hmb.onboarding.draft', JSON.stringify({ version: 2, ownerSub: 'x', phoneStep: 'verified' }))
    expect(readOnboardingDraft()).toBeNull()
    window.sessionStorage.setItem('hmb.onboarding.draft', '{not json')
    expect(readOnboardingDraft()).toBeNull()
  })

  it('updates only the phone step and resets it when Create Account is resubmitted', () => {
    saveOnboardingDraft(input)
    expect(updateOnboardingPhoneStep('dev-simulated')?.phoneStep).toBe('dev-simulated')
    expect(saveOnboardingDraft(input).phoneStep).toBe('pending')
    clearOnboardingDraft()
    expect(updateOnboardingPhoneStep('deferred')).toBeNull()
  })

  it('purges the legacy mock session and fake verified registration from localStorage', () => {
    window.localStorage.setItem('hmb.mock.user', '{"activated":true}')
    window.localStorage.setItem('hmb.mock.pendingRegistration', '{"phoneVerified":true}')
    window.localStorage.setItem('hiremebot-theme', 'dark')
    purgeLegacyMockAuthStorage()
    expect(window.localStorage.getItem('hmb.mock.user')).toBeNull()
    expect(window.localStorage.getItem('hmb.mock.pendingRegistration')).toBeNull()
    expect(window.localStorage.getItem('hiremebot-theme')).toBe('dark')
  })
})
