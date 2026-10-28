import { useMemo, useState } from 'react'
import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Trophy,
  XCircle
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { DashboardHeader } from '../components/DashboardHeader'
import { TargetProgressCard } from '../components/TargetProgressCard'
import { StatisticsCard } from '../components/StatisticsCard'
import { WeeklyActivityChart } from '../components/WeeklyActivityChart'
import { ComingSoonDialog } from '@/components/common/ComingSoonDialog'
import { MOCK_DASHBOARD_SUMMARY } from '../data/mockApplications'
import { computeDailyTarget, computeMonthlyTarget, monthLabel } from '../lib/targets'

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
    description: 'Rejection insights and recovery suggestions will be available in a future HireMeBot release.'
  }
}

export function StudentDashboardPage() {
  const { user } = useAuth()
  const [preview, setPreview] = useState<PreviewKey>(null)

  const summary = MOCK_DASHBOARD_SUMMARY
  const today = new Date()
  const daily = computeDailyTarget(today, summary.todaySubmitted)
  const monthly = useMemo(
    () => computeMonthlyTarget(summary.month.year, summary.month.monthIndex, summary.monthlySubmitted),
    [summary.month.year, summary.month.monthIndex, summary.monthlySubmitted]
  )

  if (!user) return null

  return (
    <div className="flex flex-col">
      <DashboardHeader user={user} />

      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-5">
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
              {monthLabel(summary.month.year, summary.month.monthIndex)}
            </div>
            <div className="text-xs text-muted-foreground">
              {monthly.weekdays} weekdays · 50 per day
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-primary" aria-hidden="true" />
        </section>

        {/* Target cards */}
        <div className="grid grid-cols-2 gap-3">
          <TargetProgressCard
            title="Monthly Progress"
            submitted={monthly.submitted}
            target={monthly.target}
            remaining={monthly.remaining}
            percent={monthly.percent}
          />
          <TargetProgressCard
            title="Today’s Progress"
            submitted={daily.submitted}
            target={daily.target}
            remaining={daily.remaining}
            percent={daily.percent}
            weekend={daily.isWeekend}
          />
        </div>

        {/* Statistics cards */}
        <div className="grid grid-cols-4 gap-2">
          <StatisticsCard
            icon={Clock}
            iconColor="#f59e0b"
            value={summary.previews.inReview}
            label="In Review"
            isPreview
            onClick={() => setPreview('inReview')}
          />
          <StatisticsCard
            icon={Calendar}
            iconColor="hsl(var(--primary))"
            value={summary.previews.interviews}
            label="Interviews"
            isPreview
            onClick={() => setPreview('interviews')}
          />
          <StatisticsCard
            icon={Trophy}
            iconColor="#eab308"
            value={summary.previews.offers}
            label="Offers"
            isPreview
            onClick={() => setPreview('offers')}
          />
          <StatisticsCard
            icon={XCircle}
            iconColor="hsl(var(--destructive))"
            value={summary.previews.rejected}
            label="Rejected"
            isPreview
            onClick={() => setPreview('rejected')}
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
                Target: 50 applications per weekday
              </p>
            </div>
          </div>
          <WeeklyActivityChart data={summary.weekly} target={50} />
        </section>

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
