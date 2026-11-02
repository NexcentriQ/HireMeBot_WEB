import { Link } from 'react-router-dom'
import { Bell, User2 } from 'lucide-react'
import type { StudentProfile } from '../data/apiTypes'
import { fullNameOf, initialsOf } from '../lib/studentProfile'

function greetingFor(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

type DashboardHeaderProps = {
  /**
   * Name fields from the backend student profile (`data.student`). Pass
   * null/undefined while loading, on error, or if the profile is invalid —
   * the header then shows a neutral greeting and avatar instead of a name.
   */
  profile?: Pick<StudentProfile, 'firstName' | 'lastName'> | null
  now?: Date
  /** Optional trailing slot (e.g. a Refresh button) rendered before the bell. */
  trailing?: React.ReactNode
}

export function DashboardHeader({ profile, now = new Date(), trailing }: DashboardHeaderProps) {
  const firstName = profile?.firstName.trim()
  const initials = profile ? initialsOf(profile) : ''
  const fullName = profile ? fullNameOf(profile) : ''

  return (
    <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border safe-top">
      <div className="mx-auto max-w-md flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {firstName ? `${greetingFor(now)}, ${firstName}!` : 'Welcome back!'}
          </p>
          <h1 className="text-xl font-extrabold leading-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {trailing}
          <Link
            to="/student/notifications"
            aria-label="Notifications"
            className="relative h-10 w-10 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <Bell className="h-5 w-5" />
          </Link>
          <Link
            to="/student/profile"
            aria-label={fullName ? `${fullName}, open profile` : 'Open profile'}
            className="h-9 w-9 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center text-sm font-semibold"
          >
            {initials || <User2 className="h-4 w-4" aria-hidden="true" />}
          </Link>
        </div>
      </div>
    </header>
  )
}
