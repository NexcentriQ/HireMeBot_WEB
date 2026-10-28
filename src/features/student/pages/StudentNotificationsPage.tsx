import { useState } from 'react'
import { Bell } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { cn } from '@/lib/utils'

type TabKey = 'all' | 'updates' | 'system'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'updates', label: 'Application Updates' },
  { key: 'system', label: 'System' }
]

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  all: {
    title: 'Notifications Coming Soon',
    description:
      "You'll see your application updates and important HireMeBot notifications here in a future release."
  },
  updates: {
    title: 'Application Updates Coming Soon',
    description:
      'Updates about your job applications will appear here when this feature becomes available.'
  },
  system: {
    title: 'System Notifications Coming Soon',
    description:
      'Important HireMeBot announcements and system messages will appear here in a future release.'
  }
}

export function StudentNotificationsPage() {
  const [tab, setTab] = useState<TabKey>('all')
  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications" showBack />
      <div className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Notification categories"
          className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none"
        >
          {TABS.map((t) => {
            const selected = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`notification-panel-${t.key}`}
                onClick={() => setTab(t.key)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border',
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-accent'
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div
          id={`notification-panel-${tab}`}
          role="tabpanel"
          className="rounded-2xl border border-dashed border-border bg-card/60 py-8"
        >
          <EmptyState
            icon={Bell}
            title={EMPTY_COPY[tab].title}
            description={EMPTY_COPY[tab].description}
          />
        </div>
      </div>
    </div>
  )
}
