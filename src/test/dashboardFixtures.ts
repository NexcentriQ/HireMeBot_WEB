import { MOCK_DASHBOARD } from '@/features/student/data/mockApplications'
import type { DashboardResponse, StudentProfile } from '@/features/student/data/apiTypes'

/** A deep copy of the mock dashboard with selected `student` fields overridden. */
export function dashboardFor(student: Partial<StudentProfile> = {}): DashboardResponse {
  return structuredClone({
    ...MOCK_DASHBOARD,
    student: { ...MOCK_DASHBOARD.student, ...student }
  })
}

/**
 * Seeds the MOCK auth session (route access only). Tests use an identity that
 * differs from every backend profile they assert on, which proves the UI
 * reads identity from `data.student` and never from this session.
 */
export function seedMockAuthUser(firstName = 'Zed', lastName = 'Auth') {
  window.localStorage.setItem(
    'hmb.mock.user',
    JSON.stringify({
      id: 'u-auth',
      role: 'STUDENT',
      firstName,
      lastName,
      email: 'zed.auth@mock-session.test',
      phoneE164: '+10000000000',
      activated: true
    })
  )
}
