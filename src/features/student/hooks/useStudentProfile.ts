import { useEffect, useMemo } from 'react'
import { useStudentDashboard } from './useStudentDashboard'
import { parseStudentProfile } from '../lib/studentProfile'
import type { StudentProfile } from '../data/apiTypes'

export type StudentProfileView = {
  /** The validated profile, or null while loading / on error / if malformed. */
  profile: StudentProfile | null
  /** No dashboard response yet and no error. */
  isLoading: boolean
  /** The dashboard request failed and there is no earlier response to show. */
  isError: boolean
  /** A response arrived but `data.student` is missing or malformed. */
  isInvalid: boolean
  error: unknown
  refetch: () => void
}

/**
 * Derives the student profile from the SAME TanStack Query entry that
 * powers the dashboard (`useStudentDashboard`). It is a selector, not a
 * query: there is no separate cache key and no extra backend request, so the
 * profile shares the one-hour freshness, midnight invalidation and
 * logout-clearing of the dashboard response.
 */
export function useStudentProfile(): StudentProfileView {
  const query = useStudentDashboard()
  const { data } = query

  const parsed = useMemo(() => (data ? parseStudentProfile(data.student) : null), [data])

  useEffect(() => {
    if (import.meta.env.DEV && parsed && !parsed.ok) {
      // Field names only — never log profile values (PII).
      console.error(
        `[student-profile] Dashboard response has a missing or malformed "student" object. Problem fields: ${parsed.problems.join(', ')}`
      )
    }
  }, [parsed])

  return {
    profile: parsed?.ok ? parsed.profile : null,
    isLoading: !data && !query.isError,
    isError: query.isError && !data,
    isInvalid: parsed !== null && !parsed.ok,
    error: query.error,
    refetch: () => {
      void query.refetch()
    }
  }
}
