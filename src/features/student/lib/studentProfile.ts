import type { StudentProfile } from '../data/apiTypes'

export type ProfileParseResult =
  | { ok: true; profile: StudentProfile }
  | { ok: false; problems: string[] }

/**
 * Validates `data.student` from the dashboard response. The backend contract
 * requires every field below; a missing or wrongly-typed one is a contract
 * error, so we report it instead of substituting placeholder identity data.
 *
 * `problems` lists field NAMES only — never values — so it is safe to log.
 */
export function parseStudentProfile(raw: unknown): ProfileParseResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: ['student (missing or not an object)'] }
  }
  const o = raw as Record<string, unknown>
  const problems: string[] = []
  if (typeof o.firstName !== 'string') problems.push('firstName')
  if (typeof o.lastName !== 'string') problems.push('lastName')
  if (typeof o.email !== 'string') problems.push('email')
  if (!(o.phoneE164 === null || typeof o.phoneE164 === 'string')) problems.push('phoneE164')
  if (typeof o.phoneVerified !== 'boolean') problems.push('phoneVerified')
  if (problems.length > 0) return { ok: false, problems }

  return {
    ok: true,
    profile: {
      firstName: o.firstName as string,
      lastName: o.lastName as string,
      email: o.email as string,
      phoneE164: o.phoneE164 as string | null,
      phoneVerified: o.phoneVerified as boolean
    }
  }
}

export function fullNameOf(profile: Pick<StudentProfile, 'firstName' | 'lastName'>): string {
  return [profile.firstName.trim(), profile.lastName.trim()].filter(Boolean).join(' ').trim()
}

export function initialsOf(profile: Pick<StudentProfile, 'firstName' | 'lastName'>): string {
  return `${profile.firstName.trim()[0] ?? ''}${profile.lastName.trim()[0] ?? ''}`.toUpperCase()
}

/** Returns the phone to display, or null when none is on file (null or blank). */
export function phoneOf(profile: Pick<StudentProfile, 'phoneE164'>): string | null {
  const phone = profile.phoneE164?.trim()
  return phone ? phone : null
}
