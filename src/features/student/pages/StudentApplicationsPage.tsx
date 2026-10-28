import { useMemo, useState } from 'react'
import { Search, Inbox } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { ApplicationCard } from '../components/ApplicationCard'
import { EmptyState } from '../components/EmptyState'
import { Input } from '@/components/ui/input'
import { MOCK_APPLICATIONS } from '../data/mockApplications'

export function StudentApplicationsPage() {
  const [query, setQuery] = useState('')

  const applications = useMemo(
    () => [...MOCK_APPLICATIONS].sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1)),
    []
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return applications
    return applications.filter(
      (app) =>
        app.companyName.toLowerCase().includes(q) ||
        app.jobTitle.toLowerCase().includes(q)
    )
  }, [applications, query])

  return (
    <div className="flex flex-col">
      <PageHeader title="My Applications" />

      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by company or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search applications"
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No applications found"
            description={
              query
                ? `No results for "${query}". Try a different term.`
                : 'You don’t have any applications yet.'
            }
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((app) => (
              <li key={app.applicationId}>
                <ApplicationCard application={app} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
