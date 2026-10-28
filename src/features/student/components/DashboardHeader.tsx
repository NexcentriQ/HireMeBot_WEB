import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { AuthenticatedUser } from '@/features/auth/types'

function initials(user: AuthenticatedUser): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
}

function greetingFor(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardHeader({ user, now = new Date() }: { user: AuthenticatedUser; now?: Date }) {
  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border safe-top">
      <div className="mx-auto max-w-md flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {greetingFor(now)}, {user.firstName}!
          </p>
          <h1 className="text-xl font-extrabold leading-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/student/notifications"
            aria-label="Notifications"
            className="relative h-10 w-10 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Bell className="h-5 w-5" />
          </Link>
          <Link
            to="/student/profile"
            aria-label={`${user.firstName} ${user.lastName}, open profile`}
            className="h-9 w-9 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center text-sm font-semibold"
          >
            {initials(user)}
          </Link>
        </div>
      </div>
    </header>
  )
}
