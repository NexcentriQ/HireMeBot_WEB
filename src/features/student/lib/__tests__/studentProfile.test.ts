import { describe, expect, it } from 'vitest'
import { fullNameOf, initialsOf, parseStudentProfile, phoneOf } from '../studentProfile'

const valid = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah.johnson@example.com',
  phoneE164: '+17135550123',
  phoneVerified: true
}

describe('parseStudentProfile', () => {
  it('accepts a complete profile', () => {
    const r = parseStudentProfile(valid)
    expect(r).toEqual({ ok: true, profile: valid })
  })

  it('accepts phoneE164 = null', () => {
    const r = parseStudentProfile({ ...valid, phoneE164: null })
    expect(r.ok && r.profile.phoneE164).toBeNull()
  })

  it('accepts phoneVerified true and false', () => {
    expect(parseStudentProfile({ ...valid, phoneVerified: true }).ok).toBe(true)
    const f = parseStudentProfile({ ...valid, phoneVerified: false })
    expect(f.ok && f.profile.phoneVerified).toBe(false)
  })

  it.each([undefined, null, 'student', 42, []])('rejects a non-object student (%j)', (raw) => {
    const r = parseStudentProfile(raw)
    expect(r.ok).toBe(false)
  })

  it('reports the names (not values) of malformed fields', () => {
    const r = parseStudentProfile({
      firstName: 'Sarah',
      lastName: 7,
      email: undefined,
      phoneE164: undefined, // required-but-nullable: absent is a contract error
      phoneVerified: 'yes'
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.problems).toEqual(['lastName', 'email', 'phoneE164', 'phoneVerified'])
      expect(JSON.stringify(r.problems)).not.toContain('Sarah')
    }
  })
})

describe('profile display helpers', () => {
  it('builds the full name safely', () => {
    expect(fullNameOf({ firstName: ' Sarah ', lastName: 'Johnson' })).toBe('Sarah Johnson')
    expect(fullNameOf({ firstName: 'Sarah', lastName: '' })).toBe('Sarah')
    expect(fullNameOf({ firstName: '', lastName: '' })).toBe('')
  })

  it('builds initials', () => {
    expect(initialsOf({ firstName: 'sarah', lastName: 'johnson' })).toBe('SJ')
    expect(initialsOf({ firstName: 'Sarah', lastName: '' })).toBe('S')
    expect(initialsOf({ firstName: '', lastName: '' })).toBe('')
  })

  it('treats null and blank phones as "no phone"', () => {
    expect(phoneOf({ phoneE164: '+17135550123' })).toBe('+17135550123')
    expect(phoneOf({ phoneE164: null })).toBeNull()
    expect(phoneOf({ phoneE164: '   ' })).toBeNull()
  })
})
