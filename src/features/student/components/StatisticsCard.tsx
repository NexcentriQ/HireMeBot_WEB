import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatisticsCardProps = {
  icon: LucideIcon
  iconColor?: string
  value: number | string
  label: string
  sublabel?: string
  /** When true, the card renders a subtle corner dot and advertises "preview" in its accessible name. */
  isPreview?: boolean
  onClick?: () => void
  as?: 'button' | 'div'
  ariaLabel?: string
}

export function StatisticsCard({
  icon: Icon,
  iconColor,
  value,
  label,
  sublabel,
  isPreview = false,
  onClick,
  as,
  ariaLabel
}: StatisticsCardProps) {
  const Element = (as ?? (onClick ? 'button' : 'div')) as 'button' | 'div'
  const commonClasses = cn(
    'relative rounded-2xl border border-border bg-card px-2 py-3 flex flex-col items-center text-center gap-1.5',
    'min-h-[112px] transition-colors',
    onClick && 'hover:bg-accent/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  )

  const content = (
    <>
      {isPreview && (
        <span
          aria-hidden="true"
          title="Preview — coming soon"
          className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary/70"
        />
      )}
      <Icon
        className="h-5 w-5 shrink-0"
        style={iconColor ? { color: iconColor } : undefined}
        aria-hidden="true"
      />
      <div className="text-lg font-extrabold leading-none">{value}</div>
      <div className="text-[11px] font-semibold leading-tight text-foreground whitespace-nowrap">
        {label}
      </div>
      {sublabel && (
        <div className="text-[10px] text-muted-foreground leading-tight">{sublabel}</div>
      )}
    </>
  )

  const effectiveAria = ariaLabel ?? `${label}${isPreview ? ' — preview, coming soon' : ''}`

  if (Element === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={effectiveAria}
        className={commonClasses}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={commonClasses} aria-label={effectiveAria}>
      {content}
    </div>
  )
}
