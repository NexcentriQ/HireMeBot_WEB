import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  showBack?: boolean
  onBack?: () => void
  trailing?: React.ReactNode
  showMore?: boolean
  className?: string
}

export function PageHeader({ title, showBack = false, onBack, trailing, showMore = false, className }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className={cn('sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border safe-top', className)}>
      <div className="mx-auto max-w-md flex items-center gap-2 px-4 py-3">
        {showBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (onBack ? onBack() : navigate(-1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-1" />
        )}
        <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
        {trailing}
        {showMore && (
          <button
            type="button"
            aria-label="More actions"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  )
}
