import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { studentService } from '../data/studentService'
import type { DashboardResponse } from '../data/apiTypes'
import { useAuth } from '@/features/auth/AuthProvider'
import { studentIdFromAccount } from '@/features/auth/account'

/**
 * Stable TanStack Query key for the single dashboard response. Keyed by the
 * signed-in student's backend `studentId` (from `GET /auth/me`), so switching
 * students (or logging out and back in as a different student) never reuses
 * the prior student's cache.
 */
export function studentDashboardKey(studentId?: string | number) {
  return ['student-dashboard', String(studentId ?? 'unknown')] as const
}

const ONE_HOUR_MS = 60 * 60 * 1000
const TWO_HOURS_MS = 2 * ONE_HOUR_MS

/**
 * Fetches the single dashboard payload. Backs the dashboard page, the
 * Today's Applications page, and the Application Details page from one
 * shared cache entry.
 *
 * The student id comes from the signed-in account (`useAuth().account`). The
 * query stays disabled until it is known, so nothing is fetched (or cached)
 * for an unidentified student. Route guards guarantee an ACTIVE account
 * before any `/student/*` page renders.
 *
 * Cache policy:
 *   staleTime: 1 hour     — cached response is served fresh for an hour
 *   gcTime:    2 hours    — retained in GC for a while after unmount
 *   refetchInterval: 1h   — while a subscriber is mounted AND the tab is
 *                           visible, re-fetch once an hour so an actively
 *                           open dashboard stays current. `refetchIntervalIn-
 *                           Background` defaults to false in v5, so the timer
 *                           pauses whenever the tab is hidden — no polling
 *                           when the user isn't actually looking.
 *   refetchOnWindowFocus: false — reporting-date rollover is handled
 *                                 explicitly by useReportingDateInvalidation.
 */
export function useStudentDashboard(): UseQueryResult<DashboardResponse> {
  const { account } = useAuth()
  const studentId = studentIdFromAccount(account)

  return useQuery<DashboardResponse>({
    queryKey: studentDashboardKey(studentId),
    queryFn: ({ signal }) => studentService.getDashboard({ signal, studentId }),
    enabled: studentId !== undefined,
    staleTime: ONE_HOUR_MS,
    gcTime: TWO_HOURS_MS,
    refetchInterval: ONE_HOUR_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false
    // `retry` deliberately omitted — defers to the QueryClient-level default
    // (1 in production, 0 in tests via renderWithProviders) so test runs
    // don't eat the retry-backoff delay before surfacing the error UI.
  })
}
