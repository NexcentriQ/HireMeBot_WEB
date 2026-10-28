import { MountainBackdrop } from '@/components/common/MountainBackdrop'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  dark?: boolean
  className?: string
  showMountain?: boolean
  topBar?: React.ReactNode
}

/**
 * Full-screen focused layout used by auth screens. Some screens are rendered
 * on the dark surface regardless of the global theme (per the reference
 * mockups for phone-verification and signup-success), so `dark` can force it.
 */
export function AuthLayout({ children, dark = false, className, showMountain = true, topBar }: AuthLayoutProps) {
  return (
    <div
      className={cn(
        'relative min-h-dvh flex flex-col overflow-x-hidden',
        dark ? 'dark bg-background text-foreground' : 'bg-background text-foreground',
        className
      )}
    >
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 safe-top">
        <div>{topBar}</div>
        <ThemeToggle />
      </div>
      <main className="relative z-10 flex-1 w-full max-w-md mx-auto px-6 pt-6 pb-10 flex flex-col">
        {children}
      </main>
      {showMountain && <MountainBackdrop />}
    </div>
  )
}
