import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CompanyLogo } from './CompanyLogo'
import type { Application } from '../data/types'
import { cn } from '@/lib/utils'

export function ApplicationCard({ application, className }: { application: Application; className?: string }) {
  const applied = new Date(application.appliedAt)
  const applyLabel = applied.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
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
