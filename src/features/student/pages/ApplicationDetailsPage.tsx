import { Link, useParams } from 'react-router-dom'
import { ExternalLink, FileText, MapPin } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { CompanyLogo } from '../components/CompanyLogo'
import { EmptyState } from '../components/EmptyState'
import { Button } from '@/components/ui/button'
import { MOCK_APPLICATIONS } from '../data/mockApplications'
import { cn } from '@/lib/utils'

function formatAppliedDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Pull a file extension (lowercased, no dot) out of a URL. Accepts both
 * absolute URLs (`https://…/file.pdf`) and site-relative URLs (`/samples/x.pdf`)
 * by resolving against the current origin when available.
 */
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

/**
 * V1 Application Details view. Fields are 1:1 with the backend
 * `GET /api/v1/student/applications` response (API.md): company, title,
 * location, source, applied-at, and the external job link. Resume and cover
 * letter URLs are also surfaced — the backend will begin returning them in a
 * follow-up change (sample S3 URLs are used in the mock meanwhile).
 *
 * Application-status tracking (In Review / Interview / Offer / Rejected /
 * timeline) is intentionally deferred to a future release.
 */
export function ApplicationDetailsPage() {
  const { applicationId: idParam } = useParams<{ applicationId: string }>()
  const asNumber = idParam ? Number(idParam) : NaN
  const application =
    Number.isFinite(asNumber) && Number.isInteger(asNumber)
      ? MOCK_APPLICATIONS.find((a) => a.applicationId === asNumber)
      : undefined

  if (!application) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Application" showBack />
        <EmptyState
          title="Application not found"
          description="We couldn’t find this application. It may have been removed or the link is invalid."
        >
          <Button asChild>
            <Link to="/student/applications">Back to Applications</Link>
          </Button>
        </EmptyState>
      </div>
    )
  }

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

        {/* Primary external action — open the recruiter-recorded job posting. */}
        <Button
          asChild
          size="lg"
          className="w-full"
        >
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

        {/* Job Details — strictly the backend-returned fields. */}
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
            <dd className="font-medium">{formatAppliedDate(application.appliedAt)}</dd>

            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono text-xs">#{application.applicationId}</dd>
          </dl>
        </section>

        {/* Documents — resume / cover letter S3 links. */}
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

type DocumentRowProps = {
  url: string
  label: string
}

/**
 * Renders a single resume/cover-letter row. The link opens the S3 URL in the
 * user's default browser (new tab); the browser decides whether to render the
 * PDF/DOCX inline or download it, based on the S3 object's Content-Disposition.
 * Falls back gracefully for unknown file types.
 */
function DocumentRow({ url, label }: DocumentRowProps) {
  const ext = fileExtensionFor(url)
  const extLabel = EXT_LABEL[ext]
  const isDownloadOnly = ext === 'docx' // most browsers don't render DOCX inline
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
