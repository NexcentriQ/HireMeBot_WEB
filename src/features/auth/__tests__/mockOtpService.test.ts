import { describe, expect, it, vi } from 'vitest'
import { createMockOtpService, DEV_MOCK_OTP_CODE } from '../services/mockOtpService'
import { getPhoneVerificationService, unavailablePhoneVerificationService } from '../services/phoneVerification'

const PHONE = '+17135551234'

describe('mock OTP service (development only)', () => {
  it('accepts the fixed development code and reports a simulation, never "verified"', async () => {
    const svc = createMockOtpService({ latencyMs: 0 })
    await svc.sendCode(PHONE)
    const result = await svc.verifyCode(PHONE, DEV_MOCK_OTP_CODE)
    expect(result).toEqual({ outcome: 'dev-simulated' })
    expect(JSON.stringify(result)).not.toMatch(/verified/i)
  })

  it('rejects an incorrect code', async () => {
    const svc = createMockOtpService({ latencyMs: 0 })
    await expect(svc.verifyCode(PHONE, '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' })
  })

  it.each(['', '12345', '1234567', 'abcdef', '12 456'])('rejects an incomplete or malformed code %j', async (code) => {
    const svc = createMockOtpService({ latencyMs: 0 })
    await expect(svc.verifyCode(PHONE, code)).rejects.toMatchObject({ code: 'INVALID_OTP_FORMAT' })
  })

  it('throttles resend inside the window and allows it afterwards', async () => {
    vi.useFakeTimers()
    try {
      const svc = createMockOtpService({ latencyMs: 0 })
      await svc.sendCode(PHONE)
      await expect(svc.resendCode(PHONE)).rejects.toMatchObject({ code: 'RESEND_THROTTLED' })
      vi.advanceTimersByTime(60_000)
      await expect(svc.resendCode(PHONE)).resolves.toEqual({ nextResendInSeconds: 60 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects every call when the build is not a development build', async () => {
    const svc = createMockOtpService({ latencyMs: 0 })
    vi.stubEnv('DEV', false)
    await expect(svc.sendCode(PHONE)).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_UNAVAILABLE' })
    await expect(svc.resendCode(PHONE)).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_UNAVAILABLE' })
    await expect(svc.verifyCode(PHONE, DEV_MOCK_OTP_CODE)).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_UNAVAILABLE'
    })
  })
})

describe('phone verification selection', () => {
  it('uses the mock in development', () => {
    expect(getPhoneVerificationService().available).toBe(true)
  })

  it('is unavailable in production builds and never accepts the mock code', async () => {
    vi.stubEnv('DEV', false)
    const svc = getPhoneVerificationService()
    expect(svc).toBe(unavailablePhoneVerificationService)
    expect(svc.available).toBe(false)
    await expect(svc.verifyCode(PHONE, DEV_MOCK_OTP_CODE)).rejects.toMatchObject({
      code: 'PHONE_VERIFICATION_UNAVAILABLE'
    })
  })
})
