import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ApplicationCard } from '../components/ApplicationCard'
import { EmptyState } from '../components/EmptyState'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import type { Application } from '../data/types'
import { cn } from '@/lib/utils'

export function StudentApplicationsPage() {
  const {
    data,
    isLoading,
    isError,
    isRefetchError,
    error,
    refetch,
    isFetching
  } = useStudentDashboard()
  const [pageNum, setPageNum] = useState(1)
  const [query, setQuery] = useState('')

  // Rollover handling runs once at the layout level (StudentLayout).

  // Flatten all cached pages into a single ordered list. The server already
  // ordered pages 1..N newest-first with deterministic tie-breaking, so
  // Object.keys sorted numerically yields the global sort order.
  const allApplications = useMemo<Application[]>(() => {
    if (!data) return []
    return Object.keys(data.pages)
      .map((k) => ({ key: Number(k), items: data.pages[k] ?? [] }))
      .sort((a, b) => a.key - b.key)
      .flatMap((p) => p.items)
  }, [data])

  // Enhancement 1: search spans every cached application, not just the
  // active page. No extra backend call — all of today's rows are already
  // in-memory under the single dashboard query.
  const matched = useMemo<Application[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allApplications
    return allApplications.filter(
      (app) =>
        app.companyName.toLowerCase().includes(q) ||
        app.jobTitle.toLowerCase().includes(q)
    )
  }, [allApplications, query])

  const pageSize = data?.pageSize ?? 20
  // Paginate the FILTERED list — not the server's pages — so Prev/Next walks
  // the search result set.
  const totalPagesForView = Math.max(0, Math.ceil(matched.length / pageSize))
  const start = (pageNum - 1) * pageSize
  const currentPageItems = matched.slice(start, start + pageSize)

  // Reset to page 1 when the search query changes or the reporting date
  // changes (student switch, midnight rollover, cache invalidated).
  useEffect(() => {
    setPageNum(1)
  }, [query, data?.date])

  // Clamp when totalPages shrinks (e.g. refetch returns fewer pages, or
  // filter narrows the result set below the current pageNum).
  useEffect(() => {
    if (totalPagesForView > 0 && pageNum > totalPagesForView) {
      setPageNum(1)
    }
  }, [totalPagesForView, pageNum])

  // Enhancement 2: when a background refetch fails but we still have the
  // last successful payload, surface a dismissible notice instead of
  // silently rendering stale numbers as if nothing happened.
  const showRefetchBanner = isRefetchError && !!data

  return (
    <div className="flex flex-col">
      <PageHeader title="Today's Applications" />

      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-4">
        {isError && !data ? (
          <ApplicationsErrorCard message={extractMessage(error)} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <ApplicationsSkeleton />
        ) : data.totalApplications === 0 ? (
          <>
            {showRefetchBanner && (
              <RefetchErrorBanner message={extractMessage(error)} onRetry={() => refetch()} isFetching={isFetching} />
            )}
            <EmptyState
              icon={Inbox}
              title="No applications recorded for today yet"
              description="Your recruiter hasn’t recorded any applications for today. Check back later."
            />
          </>
        ) : (
          <>
            {showRefetchBanner && (
              <RefetchErrorBanner message={extractMessage(error)} onRetry={() => refetch()} isFetching={isFetching} />
            )}

            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search today’s applications by company or role"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                aria-label="Search applications"
              />
            </div>

            {matched.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No matches today"
                description={`No results for "${query}" across today's ${data.totalApplications} applications.`}
              />
            ) : (
              <ul className="space-y-2" aria-label="Today's applications">
                {currentPageItems.map((app) => (
                  <li key={app.applicationId}>
                    <ApplicationCard
                      application={app}
                      timeZone={data.statistics.timezone}
                    />
                  </li>
                ))}
              </ul>
            )}

            <PaginationBar
              pageNum={pageNum}
              totalPages={totalPagesForView}
              totalMatched={matched.length}
              totalApplications={data.totalApplications}
              pageSize={pageSize}
              isFiltering={query.trim().length > 0}
              onChange={setPageNum}
            />
          </>
        )}
      </div>
    </div>
  )
}

function PaginationBar({
  pageNum,
  totalPages,
  totalMatched,
  totalApplications,
  pageSize,
  isFiltering,
  onChange
}: {
  pageNum: number
  totalPages: number
  totalMatched: number
  totalApplications: number
  pageSize: number
  isFiltering: boolean
  onChange: (n: number) => void
}) {
  if (totalPages <= 0) return null
  const atStart = pageNum <= 1
  const atEnd = pageNum >= totalPages
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center gap-1 pt-1">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={atStart}
          onClick={() => onChange(pageNum - 1)}
          aria-label="Previous page"
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Prev
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          Page <span className="font-semibold text-foreground">{pageNum}</span> of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={atEnd}
          onClick={() => onChange(pageNum + 1)}
          aria-label="Next page"
          className="gap-1"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {isFiltering
          ? `${totalMatched} of ${totalApplications} match · ${pageSize} per page`
          : `${totalApplications} total · ${pageSize} per page`}
      </div>
    </nav>
  )
}

function ApplicationsSkeleton() {
  return (
    <>
      <div className="rounded-xl h-12 bg-muted/40 animate-pulse" />
      <ul className="space-y-2" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <li key={i} className="rounded-2xl h-16 bg-muted/40 animate-pulse" />
        ))}
      </ul>
      <div className="flex items-center justify-center text-muted-foreground gap-2 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading applications…
      </div>
    </>
  )
}

function ApplicationsErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-destructive/40 bg-destructive/5 p-4',
        'flex flex-col gap-3'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Could not load applications</div>
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
