import { useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Trophy,
  XCircle
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { DashboardHeader } from '../components/DashboardHeader'
import { TargetProgressCard } from '../components/TargetProgressCard'
import { StatisticsCard } from '../components/StatisticsCard'
import { WeeklyActivityChart } from '../components/WeeklyActivityChart'
import { ComingSoonDialog } from '@/components/common/ComingSoonDialog'
import { Button } from '@/components/ui/button'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import { monthLabelFromIso } from '../lib/targets'
import type { DashboardStatistics } from '../data/apiTypes'
import { cn } from '@/lib/utils'

type PreviewKey = 'inReview' | 'interviews' | 'offers' | 'rejected' | null

const PREVIEW_COPY: Record<Exclude<PreviewKey, null>, { title: string; description: string }> = {
  inReview: {
    title: 'Coming in a Future Release',
    description:
      'Detailed application review tracking will be available in a future HireMeBot release.'
  },
  interviews: {
    title: 'Coming in a Future Release',
    description:
      'Interview tracking and scheduling will be available in a future HireMeBot release.'
  },
  offers: {
    title: 'Coming in a Future Release',
    description: 'Offer tracking will be available in a future HireMeBot release.'
  },
  rejected: {
    title: 'Coming in a Future Release',
    description:
      'Rejection insights and recovery suggestions will be available in a future HireMeBot release.'
  }
}

export function StudentDashboardPage() {
  const { user } = useAuth()
  const [preview, setPreview] = useState<PreviewKey>(null)
  const { data, isLoading, isFetching, isError, isRefetchError, error, refetch } =
    useStudentDashboard()

  if (!user) return null

  // Enhancement 2: a background refetch (hourly refetch, Refresh click after
  // success, midnight invalidation) that FAILS while we still have a prior
  // successful payload — show a non-destructive banner so the user is not
  // misled into thinking the numbers are fresh.
  const showRefetchBanner = isRefetchError && !!data

  return (
    <div className="flex flex-col">
      <DashboardHeader
        user={user}
        trailing={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh dashboard"
            className="h-9 w-9 p-0"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-5">
        {isError && !data ? (
          <DashboardErrorCard message={extractMessage(error)} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            {showRefetchBanner && (
              <RefetchErrorBanner
                message={extractMessage(error)}
                onRetry={() => refetch()}
                isFetching={isFetching}
              />
            )}
            <DashboardLoaded statistics={data.statistics} onPreview={setPreview} />
          </>
        )}
      </div>

      <ComingSoonDialog
        open={preview !== null}
        onOpenChange={(v) => !v && setPreview(null)}
        title={preview ? PREVIEW_COPY[preview].title : undefined}
        description={preview ? PREVIEW_COPY[preview].description : undefined}
      />
    </div>
  )
}

function DashboardLoaded({
  statistics,
  onPreview
}: {
  statistics: DashboardStatistics
  onPreview: (k: PreviewKey) => void
}) {
  const { monthlyProgress, todayProgress, weeklyActivity } = statistics
  const weekdayHint = monthlyProgress.target > 0 ? monthlyProgress.target / 50 : 0

  return (
    <>
      {/* Month card */}
      <section
        aria-label="Selected month"
        className="rounded-2xl bg-primary/10 border border-primary/15 px-4 py-3 flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {monthLabelFromIso(monthlyProgress.month)}
          </div>
          <div className="text-xs text-muted-foreground">
            {weekdayHint > 0 ? `${weekdayHint} weekdays · 50 per day` : ' '}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-primary" aria-hidden="true" />
      </section>

      {/* Target cards — bind directly to backend values */}
      <div className="grid grid-cols-2 gap-3">
        <TargetProgressCard
          title="Monthly Progress"
          submitted={monthlyProgress.applied}
          target={monthlyProgress.target}
          remaining={monthlyProgress.remaining}
          percent={monthlyProgress.percentage}
        />
        <TargetProgressCard
          title="Today’s Progress"
          submitted={todayProgress.applied}
          target={todayProgress.target}
          remaining={todayProgress.remaining}
          percent={todayProgress.percentage}
        />
      </div>

      {/*
        Preview tiles. Values are sample placeholders (NOT returned by the
        V1 backend). The "Coming Soon" pill + click-through dialog make the
        preview nature explicit; the number is retained purely for the
        intended visual rhythm of the dashboard.
      */}
      <div className="grid grid-cols-4 gap-2">
        <StatisticsCard
          icon={Clock}
          iconColor="#f59e0b"
          value={126}
          label="In Review"
          isPreview
          onClick={() => onPreview('inReview')}
        />
        <StatisticsCard
          icon={Calendar}
          iconColor="hsl(var(--primary))"
          value={8}
          label="Interviews"
          isPreview
          onClick={() => onPreview('interviews')}
        />
        <StatisticsCard
          icon={Trophy}
          iconColor="#eab308"
          value={2}
          label="Offers"
          isPreview
          onClick={() => onPreview('offers')}
        />
        <StatisticsCard
          icon={XCircle}
          iconColor="hsl(var(--destructive))"
          value={54}
          label="Rejected"
          isPreview
          onClick={() => onPreview('rejected')}
        />
      </div>

      {/* Weekly activity */}
      <section
        aria-labelledby="weekly-activity-heading"
        className="rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h2 id="weekly-activity-heading" className="text-sm font-semibold">
              Weekly Activity (This Week)
            </h2>
            <p className="text-xs text-muted-foreground">
              Target: {weeklyActivity.targetPerWeekday} applications per weekday
            </p>
          </div>
        </div>
        <WeeklyActivityChart
          data={weeklyActivity.days.map((d) => ({ day: d.day, submitted: d.applications }))}
          target={weeklyActivity.targetPerWeekday}
        />
      </section>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="rounded-2xl h-14 bg-muted/40 animate-pulse" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl h-32 bg-muted/40 animate-pulse" />
        <div className="rounded-2xl h-32 bg-muted/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl h-28 bg-muted/40 animate-pulse" />
        <div className="rounded-2xl h-28 bg-muted/40 animate-pulse" />
        <div className="rounded-2xl h-28 bg-muted/40 animate-pulse" />
        <div className="rounded-2xl h-28 bg-muted/40 animate-pulse" />
      </div>
      <div className="rounded-2xl h-56 bg-muted/40 animate-pulse" />
      <p className="sr-only" role="status" aria-live="polite">
        Loading dashboard…
      </p>
      <div className="flex items-center justify-center text-muted-foreground gap-2 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading dashboard…
      </div>
    </>
  )
}

function DashboardErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Could not load your dashboard</div>
          <div className="text-xs text-muted-foreground mt-1 break-words">{message}</div>
        </div>
      </div>
      <Button size="sm" onClick={onRetry} className="self-start">
        Retry
      </Button>
    </div>
  )
}

function RefetchErrorBanner({
  message,
  onRetry,
  isFetching
}: {
  message: string
  onRetry: () => void
  isFetching: boolean
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center gap-2 text-xs"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">Showing previously loaded data.</span>{' '}
        <span className="text-muted-foreground break-words">Refresh failed: {message}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2"
        onClick={onRetry}
        disabled={isFetching}
        aria-label="Retry refresh"
      >
        <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} aria-hidden="true" />
        Retry
      </Button>
    </div>
  )
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message
  }
  return 'Unexpected error while contacting the HireMeBot API.'
}
