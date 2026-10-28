import { beforeEach, describe, expect, it } from 'vitest'
import { MockAuthService } from '../services/MockAuthService'
import { AuthServiceError } from '../types'

describe('MockAuthService', () => {
  let svc: MockAuthService

  beforeEach(() => {
    window.localStorage.clear()
    svc = new MockAuthService()
  })

  it('rejects startRegistration when terms are not agreed', async () => {
    await expect(
      svc.startRegistration({
        firstName: 'John',
        lastName: 'Doe',
        phoneE164: '+17135551234',
        agreedToTerms: false
      })
    ).rejects.toBeInstanceOf(AuthServiceError)
  })

  it('completes a happy-path registration', async () => {
    const pending = await svc.startRegistration({
      firstName: 'John',
      lastName: 'Doe',
      phoneE164: '+17135551234',
      agreedToTerms: true
    })
    expect(pending.phoneVerified).toBe(false)

    await expect(
      svc.verifyPhoneOtp({ registrationId: pending.registrationId, code: '000000' })
    ).rejects.toMatchObject({ code: 'INVALID_OTP' })

    const verified = await svc.verifyPhoneOtp({
      registrationId: pending.registrationId,
      code: '123456'
    })
    expect(verified.phoneVerified).toBe(true)

    const google = await svc.completeGoogleAuthentication({})
    expect(google.emailVerified).toBe(true)

    const user = await svc.activateStudentAccount({
      registrationId: pending.registrationId,
      sessionRef: google.sessionRef
    })
    expect(user.role).toBe('STUDENT')
    expect(user.activated).toBe(true)

    const current = await svc.getCurrentUser()
    expect(current?.id).toBe(user.id)
  })

  it('throttles resend within the window', async () => {
    const pending = await svc.startRegistration({
      firstName: 'A',
      lastName: 'B',
      phoneE164: '+17135551234',
      agreedToTerms: true
    })
    await expect(svc.resendPhoneOtp(pending.registrationId)).rejects.toMatchObject({
      code: 'RESEND_THROTTLED'
    })
  })

  it('refuses activation when phone is not verified', async () => {
    const pending = await svc.startRegistration({
      firstName: 'A',
      lastName: 'B',
      phoneE164: '+17135551234',
      agreedToTerms: true
    })
    await expect(
      svc.activateStudentAccount({ registrationId: pending.registrationId, sessionRef: 'x' })
    ).rejects.toMatchObject({ code: 'PHONE_NOT_VERIFIED' })
  })
})
