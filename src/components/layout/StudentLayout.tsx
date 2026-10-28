import { Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { BottomNav } from '@/features/student/components/BottomNav'

export function StudentLayout() {
  const { user } = useAuth()
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
