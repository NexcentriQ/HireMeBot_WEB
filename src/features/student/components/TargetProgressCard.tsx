import { cn } from '@/lib/utils'
import { clampPercent, roundPercentForDisplay } from '../lib/targets'

type TargetProgressCardProps = {
  title: string
  submitted: number
  target: number
  remaining: number
  percent: number
  footerNote?: React.ReactNode
  weekend?: boolean
  className?: string
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
  const pct = roundPercentForDisplay(clampPercent(percent))

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
            aria-valuenow={pct}
            aria-label={`${title} progress`}
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{remaining.toLocaleString()} remaining</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
        </>
      )}

      {footerNote && <div className="text-xs text-muted-foreground">{footerNote}</div>}
    </div>
  )
}
