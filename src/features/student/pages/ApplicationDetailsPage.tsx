import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ExternalLink, FileText, Loader2, MapPin } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { CompanyLogo } from '../components/CompanyLogo'
import { EmptyState } from '../components/EmptyState'
import { Button } from '@/components/ui/button'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import { formatAppliedLong } from '../lib/formatDate'
import type { Application } from '../data/types'
import type { DashboardResponse } from '../data/apiTypes'
import { cn } from '@/lib/utils'

function fileExtensionFor(url: string): 'pdf' | 'docx' | 'file' {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://local'
    const path = new URL(url, base).pathname.toLowerCase()
    if (path.endsWith('.pdf')) return 'pdf'
    if (path.endsWith('.docx')) return 'docx'
    return 'file'
  } catch {
    return 'file'
  }
}

const EXT_LABEL: Record<'pdf' | 'docx' | 'file', string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  file: 'Document'
}

function findApplication(
  dashboard: DashboardResponse | undefined,
  applicationId: number
): Application | undefined {
  if (!dashboard) return undefined
  for (const key of Object.keys(dashboard.pages)) {
    const page = dashboard.pages[key]
    if (!page) continue
    const hit = page.find((a) => a.applicationId === applicationId)
    if (hit) return hit
  }
  return undefined
}

export function ApplicationDetailsPage() {
  const navigate = useNavigate()
  const { applicationId: idParam } = useParams<{ applicationId: string }>()
  const asNumber = idParam ? Number(idParam) : NaN
  const isValidId = Number.isFinite(asNumber) && Number.isInteger(asNumber)

  // One shared cache entry powers all three student pages. If this is a
  // hard refresh, this call triggers the single fetch per the spec.
  const { data: dashboard, isLoading, isError, error, refetch } = useStudentDashboard()
  const application = isValidId ? findApplication(dashboard, asNumber) : undefined

  // Invalid URL id → not-available immediately, don't wait on the fetch.
  if (!isValidId) return <Unavailable idParam={idParam} navigate={navigate} />

  // Still fetching the one dashboard call.
  if (isLoading) return <DetailsSkeleton />

  // Fetch errored (and nothing in cache). Live mode must never substitute
  // mock data; show error + Retry.
  if (isError && !application) {
    return <ErrorView message={extractMessage(error)} onRetry={() => refetch()} />
  }

  if (!application) {
    return <Unavailable idParam={idParam} navigate={navigate} />
  }

  const timeZone = dashboard?.statistics.timezone

  return (
    <div className="flex flex-col">
      <PageHeader title="" showBack showMore />
      <div className="mx-auto w-full max-w-md px-4 pb-6 flex flex-col gap-4">
        <section className="flex flex-col items-center text-center">
          <CompanyLogo name={application.companyName} size={64} />
          <h1 className="mt-3 text-xl font-extrabold">{application.companyName}</h1>
          <p className="text-sm text-foreground font-semibold">{application.jobTitle}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {application.jobLocation}
          </p>
        </section>

        <Button asChild size="lg" className="w-full">
          <a
            href={application.jobLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View job posting at ${application.companyName} (opens in a new tab)`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View Job Posting
          </a>
        </Button>

        <section
          aria-labelledby="job-details-heading"
          className="rounded-2xl border border-border bg-card px-4 py-4"
        >
          <h2 id="job-details-heading" className="text-sm font-bold mb-3">
            Job Details
          </h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{application.companyName}</dd>

            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{application.jobTitle}</dd>

            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium">{application.jobLocation}</dd>

            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-medium">{application.jobSource}</dd>

            <dt className="text-muted-foreground">Applied On</dt>
            <dd className="font-medium">
              {formatAppliedLong(application.appliedAt, { timeZone })}
            </dd>

            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono text-xs">#{application.applicationId}</dd>
          </dl>
        </section>

        {(application.resumeUrl || application.coverLetterUrl) && (
          <section
            aria-labelledby="documents-heading"
            className="rounded-2xl border border-border bg-card px-4 py-4"
          >
            <h2 id="documents-heading" className="text-sm font-bold mb-3">
              Documents
            </h2>
            <ul className="space-y-2">
              {application.resumeUrl && (
                <DocumentRow url={application.resumeUrl} label="Resume" />
              )}
              {application.coverLetterUrl && (
                <DocumentRow url={application.coverLetterUrl} label="Cover Letter" />
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function DocumentRow({ url, label }: { url: string; label: string }) {
  const ext = fileExtensionFor(url)
  const extLabel = EXT_LABEL[ext]
  const isDownloadOnly = ext === 'docx'
  const actionLabel = isDownloadOnly ? 'Download' : 'View'

  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        {...(isDownloadOnly ? { download: '' } : {})}
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-3',
          'hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label={`${actionLabel} ${label} (${extLabel}, opens in a new tab)`}
      >
        <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">{extLabel}</div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {actionLabel}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </a>
    </li>
  )
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col">
      <PageHeader title="" showBack />
      <div className="mx-auto w-full max-w-md px-4 pb-6 flex flex-col gap-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/40 animate-pulse self-center" />
        <div className="h-5 w-40 bg-muted/40 animate-pulse rounded self-center" />
        <div className="h-10 w-full bg-muted/40 animate-pulse rounded-xl" />
        <div className="h-40 w-full bg-muted/40 animate-pulse rounded-2xl" />
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Loading application…
        </div>
      </div>
    </div>
  )
}

function Unavailable({
  idParam,
  navigate
}: {
  idParam: string | undefined
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="flex flex-col">
      <PageHeader title="Application" showBack />
      <EmptyState
        title="Application details are unavailable."
        description={
          idParam
            ? `We could not find application #${idParam} in your current data. It may belong to a previous day or no longer exist.`
            : 'The requested application could not be found.'
        }
      >
        <Button onClick={() => navigate('/student/applications')}>
          Return to Today's Applications
        </Button>
      </EmptyState>
    </div>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col">
      <PageHeader title="Application" showBack />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Could not load this application</div>
              <div className="text-xs text-muted-foreground mt-1 break-words">{message}</div>
            </div>
          </div>
          <div className="flex gap-2 self-end">
            <Button variant="outline" size="sm" asChild>
              <Link to="/student/applications">Back</Link>
            </Button>
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message
  }
  return 'Unexpected error while contacting the HireMeBot API.'
}
