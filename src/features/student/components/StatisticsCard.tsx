import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatisticsCardProps = {
  icon: LucideIcon
  iconColor?: string
  /**
   * The headline number. Pass `undefined` to render the tile without a
   * number — used by preview tiles whose underlying feature is not yet
   * supported by the backend (In Review / Interviews / Offers / Rejected).
   */
  value?: number | string
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

  const hasValue = value !== undefined && value !== null
  const content = (
    <>
      <Icon
        className="h-5 w-5 shrink-0"
        style={iconColor ? { color: iconColor } : undefined}
        aria-hidden="true"
      />
      {hasValue && <div className="text-lg font-extrabold leading-none">{value}</div>}
      <div className="text-[11px] font-semibold leading-tight text-foreground whitespace-nowrap">
        {label}
      </div>
      {isPreview ? (
        <span
          className="inline-block whitespace-nowrap rounded-full px-2 py-[2px] text-[9px] font-bold leading-none bg-gradient-to-r from-primary to-sky-400 text-primary-foreground shadow-sm ring-1 ring-white/15"
          aria-hidden="true"
        >
          Coming Soon
        </span>
      ) : (
        sublabel && (
          <div className="text-[10px] text-muted-foreground leading-tight">{sublabel}</div>
        )
      )}
    </>
  )

  const effectiveAria =
    ariaLabel ?? `${label}${isPreview ? ' — coming soon' : ''}`

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
