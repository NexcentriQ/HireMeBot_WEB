import { MOCK_DASHBOARD } from '@/features/student/data/mockApplications'
import type { DashboardResponse, StudentProfile } from '@/features/student/data/apiTypes'
import { setFakeCognitoUser } from './fakeAmplifyAuth'

/** A deep copy of the mock dashboard with selected `student` fields overridden. */
export function dashboardFor(student: Partial<StudentProfile> = {}): DashboardResponse {
  return structuredClone({
    ...MOCK_DASHBOARD,
    student: { ...MOCK_DASHBOARD.student, ...student }
  })
}

/**
 * Seeds a fake Cognito session (route access only). Tests use an identity that
 * differs from every backend profile they assert on, which proves the UI
 * reads identity from `data.student` and never from the auth session.
 */
export function seedMockAuthUser(firstName = 'Zed', lastName = 'Auth') {
  setFakeCognitoUser({
    sub: 'u-auth',
    givenName: firstName,
    familyName: lastName,
    email: 'zed.auth@mock-session.test',
    emailVerified: true
  })
}
