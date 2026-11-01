import { cn } from '@/lib/utils'

type TargetProgressCardProps = {
  title: string
  submitted: number
  target: number
  remaining: number
  /**
   * Server-rounded percentage. Rendered verbatim in the label (so 115% is
   * shown as 115%), but the progress bar's visual width is clamped to 100%.
   */
  percent: number
  footerNote?: React.ReactNode
  weekend?: boolean
  className?: string
}

function clampForBar(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(100, value)
}

export function TargetProgressCard({
  title,
  submitted,
  target,
  remaining,
  percent,
  footerNote,
  weekend = false,
  className
}: TargetProgressCardProps) {
  const barWidth = clampForBar(percent)
  const label = `${Math.round(percent)}%`

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 flex flex-col gap-3', className)}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>

      {weekend ? (
        <p className="text-sm text-muted-foreground">No applications required today.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-foreground">{submitted.toLocaleString()}</span>
            <span className="text-sm font-medium text-muted-foreground">/ {target.toLocaleString()}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={barWidth}
            aria-label={`${title} progress`}
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{remaining.toLocaleString()} remaining</span>
            <span className="font-semibold text-foreground">{label}</span>
          </div>
        </>
      )}

      {footerNote && <div className="text-xs text-muted-foreground">{footerNote}</div>}
    </div>
  )
}
