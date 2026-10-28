import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { SignupPage } from '@/features/auth/pages/SignupPage'
import { VerifyPhonePage } from '@/features/auth/pages/VerifyPhonePage'
import { ConnectGooglePage } from '@/features/auth/pages/ConnectGooglePage'
import { AuthCallbackPage } from '@/features/auth/pages/AuthCallbackPage'
import { SignupSuccessPage } from '@/features/auth/pages/SignupSuccessPage'
import { StudentDashboardPage } from '@/features/student/pages/StudentDashboardPage'
import { StudentApplicationsPage } from '@/features/student/pages/StudentApplicationsPage'
import { ApplicationDetailsPage } from '@/features/student/pages/ApplicationDetailsPage'
import { StudentProfilePage } from '@/features/student/pages/StudentProfilePage'
import { StudentNotificationsPage } from '@/features/student/pages/StudentNotificationsPage'
import { StudentLayout } from '@/components/layout/StudentLayout'
import {
  GuestOnly,
  RequireActivatedUser,
  RequirePendingRegistration,
  RequireStudent
} from '@/routes/guards'
import { NotFoundPage } from '@/routes/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignupPage />
          </GuestOnly>
        }
      />
      <Route
        path="/verify-phone"
        element={
          <RequirePendingRegistration>
            <VerifyPhonePage />
          </RequirePendingRegistration>
        }
      />
      <Route
        path="/connect-google"
        element={
          <RequirePendingRegistration needsPhoneVerified>
            <ConnectGooglePage />
          </RequirePendingRegistration>
        }
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/signup-success"
        element={
          <RequireActivatedUser>
            <SignupSuccessPage />
          </RequireActivatedUser>
        }
      />

      <Route
        path="/student"
        element={
          <RequireStudent>
            <StudentLayout />
          </RequireStudent>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboardPage />} />
        <Route path="applications" element={<StudentApplicationsPage />} />
        <Route path="applications/:applicationId" element={<ApplicationDetailsPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
        <Route path="notifications" element={<StudentNotificationsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
