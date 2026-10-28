import { MOCK_APPLICATIONS, MOCK_DASHBOARD_SUMMARY } from './mockApplications'
import type { Application, DashboardSummary } from './types'

/**
 * Dev-only in-process service that returns the sample dashboard & application
 * data. Swap this module for a real API client once the backend ships.
 *
 * Note on `getApplicationById`: the backend has no "get application by id"
 * endpoint today — the only student-facing read is the day's list. The real
 * implementation will likely need either a new endpoint or a cache keyed by
 * the day the user came from.
 */
export const studentService = {
  async getStudentDashboardSummary(): Promise<DashboardSummary> {
    return MOCK_DASHBOARD_SUMMARY
  },
  async getStudentApplications(): Promise<Application[]> {
    return [...MOCK_APPLICATIONS].sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1))
  },
  async getRecentApplications(limit = 5): Promise<Application[]> {
    const sorted = [...MOCK_APPLICATIONS].sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1))
    return sorted.slice(0, limit)
  },
  async getApplicationById(applicationId: number): Promise<Application | null> {
    return MOCK_APPLICATIONS.find((a) => a.applicationId === applicationId) ?? null
  }
}

/**
 * Front-end only helper. The backend returns `companyName` but no brand slug;
 * we derive one from the display name to pick a brand mark/color locally.
 */
export function companySlugFor(companyName: string): string {
  return companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')
}
