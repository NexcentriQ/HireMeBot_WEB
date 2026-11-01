import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CompanyLogo } from './CompanyLogo'
import { formatAppliedShort } from '../lib/formatDate'
import type { Application } from '../data/types'
import { cn } from '@/lib/utils'

type ApplicationCardProps = {
  application: Application
  /** IANA zone from the server; renders dates in the reporting zone when supplied. */
  timeZone?: string
  className?: string
}

export function ApplicationCard({ application, timeZone, className }: ApplicationCardProps) {
  const applyLabel = formatAppliedShort(application.appliedAt, { timeZone })
  return (
    <Link
      to={`/student/applications/${application.applicationId}`}
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3',
        'hover:bg-accent/40 transition-colors',
        className
      )}
      aria-label={`${application.companyName} — ${application.jobTitle}`}
    >
      <CompanyLogo name={application.companyName} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{application.companyName}</div>
        <div className="text-sm text-muted-foreground truncate">{application.jobTitle}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Applied on {applyLabel}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </Link>
  )
}
