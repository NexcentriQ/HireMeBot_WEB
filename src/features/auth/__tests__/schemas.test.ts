import { describe, expect, it } from 'vitest'
import { signupSchema, toE164 } from '../schemas'

describe('signup schema', () => {
  const baseValid = {
    firstName: 'John',
    lastName: 'Doe',
    countryCode: 'US',
    phoneNumber: '7135551234',
    agreedToTerms: true as const
  }

  it('accepts a valid US phone number', () => {
    expect(signupSchema.safeParse(baseValid).success).toBe(true)
  })

  it('rejects an empty first name', () => {
    const res = signupSchema.safeParse({ ...baseValid, firstName: '   ' })
    expect(res.success).toBe(false)
  })

  it('rejects an invalid phone number', () => {
    const res = signupSchema.safeParse({ ...baseValid, phoneNumber: '123' })
    expect(res.success).toBe(false)
  })

  it('requires terms agreement', () => {
    const res = signupSchema.safeParse({
      ...baseValid,
      agreedToTerms: false as unknown as true
    })
    expect(res.success).toBe(false)
  })
})

describe('toE164', () => {
  it('normalizes a US local number to E.164', () => {
    expect(toE164('US', '7135551234')).toBe('+17135551234')
  })

  it('returns null for invalid phone', () => {
    expect(toE164('US', '123')).toBeNull()
  })

  it('handles international formats', () => {
    expect(toE164('IN', '9876543210')).toBe('+919876543210')
  })
})
