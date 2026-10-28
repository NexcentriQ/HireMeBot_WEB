import { NavLink } from 'react-router-dom'
import { Home, Briefcase, User2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/student/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/student/applications', label: 'Applications', icon: Briefcase, end: false },
  { to: '/student/profile', label: 'Profile', icon: User2, end: false }
]

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-1.5 text-xs font-medium rounded-lg',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} aria-hidden="true" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
