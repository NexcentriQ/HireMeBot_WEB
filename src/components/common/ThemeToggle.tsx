import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/app/ThemeProvider'
import { cn } from '@/lib/utils'

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light theme', icon: <Sun className="h-4 w-4" /> },
  { value: 'system', label: 'System theme', icon: <Monitor className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark theme', icon: <Moon className="h-4 w-4" /> }
]

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center rounded-full border border-border bg-card/70 backdrop-blur p-1 gap-1', className)}
    >
      {OPTIONS.map((opt) => {
        const selected = theme === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {opt.icon}
          </button>
        )
      })}
    </div>
  )
}
