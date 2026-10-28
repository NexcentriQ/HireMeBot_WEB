/**
 * Shape matches the backend `GET /api/v1/student/applications` response per
 * contract in API.md. Fields that are UI-only (e.g. derived company slug for
 * logo rendering) are computed at the component layer, not stored here.
 *
 * `resumeUrl` and `coverLetterUrl` are not yet returned by the backend GET
 * (they are only accepted on the recruiter POST today). They are present on
 * this type so the student application-view can surface them as soon as the
 * backend starts returning them. Until then, the mock provides sample S3 URLs.
 */
export type Application = {
  applicationId: number
  companyName: string
  jobTitle: string
  jobLocation: string
  jobLink: string
  jobSource: string
  appliedAt: string // ISO UTC, e.g. "2026-10-25T15:30:00Z"
  resumeUrl?: string
  coverLetterUrl?: string
}

/**
 * Aggregate monthly figures displayed on the dashboard. These are *sample*
 * values, not derived from the sample applications list — the real backend
 * will provide these from the full dataset of hundreds of applications.
 */
export type DashboardSummary = {
  month: { year: number; monthIndex: number }
  monthlySubmitted: number
  todaySubmitted: number
  previews: {
    inReview: number
    interviews: number
    offers: number
    rejected: number
  }
  weekly: Array<{ day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'; submitted: number }>
}
