import type { Application } from './types'

/**
 * Response types for `GET /api/v1/student/applications` (see API.md).
 * Field names and shapes are 1:1 with the backend wire format — do not
 * rename them locally. Backend-rendered values that the UI consumes
 * directly (e.g. percentages, targets) are preserved exactly.
 */

export type MonthlyProgress = {
  month: string // "YYYY-MM"
  applied: number
  target: number
  remaining: number
  /** Server-rounded, not capped at 100. May exceed 100 in overachieving months. */
  percentage: number
}

export type TodayProgress = {
  date: string // "YYYY-MM-DD"
  applied: number
  target: number
  remaining: number
  /** Server-rounded, not capped at 100. */
  percentage: number
}

export type WeekdayActivity = {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
  date: string // "YYYY-MM-DD"
  applications: number
}

export type WeeklyActivity = {
  weekStartDate: string // Monday
  targetPerWeekday: number
  days: WeekdayActivity[] // always length 5, Mon..Fri
}

export type DashboardStatistics = {
  asOfDate: string
  timezone: string // IANA zone, e.g. "America/Chicago"
  monthlyProgress: MonthlyProgress
  todayProgress: TodayProgress
  weeklyActivity: WeeklyActivity
}

/**
 * The payload under `data` in a successful response. Pages are keyed by
 * their 1-based page number as a string: `pages["1"]`, `pages["2"]`, …
 */
export type DashboardResponse = {
  studentId: number
  date: string
  totalApplications: number
  pageSize: number
  totalPages: number
  pages: Record<string, Application[]>
  statistics: DashboardStatistics
}

export type ApiErrorEnvelope = {
  success: false
  error:
    | 'BAD_REQUEST'
    | 'VALIDATION_ERROR'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'METHOD_NOT_ALLOWED'
    | 'CONFLICT'
    | 'INTERNAL_ERROR'
    | 'SERVICE_UNAVAILABLE'
    | string // widen for forward-compat
  message: string
  details?: string[]
}

export type ApiSuccessEnvelope<T> = {
  success: true
  data: T
}
