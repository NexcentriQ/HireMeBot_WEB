import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { BottomNav } from '@/features/student/components/BottomNav'
import { useStudentDashboard } from '@/features/student/hooks/useStudentDashboard'
import { useReportingDateInvalidation } from '@/features/student/lib/reportingDate'

export function StudentLayout() {
  const { user } = useAuth()
  // Observe the shared dashboard query (TanStack Query dedupes to one
  // underlying fetch across the layout, dashboard, applications, and
  // details pages). We only need `timezone` + `date` to drive reporting-
  // date invalidation from a single scheduler at the layout level.
  const { data } = useStudentDashboard()
  useReportingDateInvalidation({
    timeZone: data?.statistics.timezone,
    cachedDate: data?.date
  })

  if (!user) return null
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <main className="flex-1 flex flex-col pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
