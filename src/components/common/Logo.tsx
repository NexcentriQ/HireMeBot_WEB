import { cn } from '@/lib/utils'

type LogoProps = {
  size?: number
  withText?: boolean
  tagline?: boolean
  className?: string
}

export function LogoMark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex items-center justify-center rounded-2xl overflow-hidden',
        'bg-gradient-to-br from-indigo-500 via-primary to-fuchsia-500',
        'shadow-lg shadow-primary/30 ring-1 ring-white/15',
        className
      )}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/25"
      />
      <svg
        viewBox="0 0 48 48"
        width={size * 0.62}
        height={size * 0.62}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        className="relative z-10 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="hmb-rocket-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e5e7ff" />
          </linearGradient>
          <linearGradient id="hmb-rocket-flame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <path
          d="M24 5c5.6 3.6 9 9.4 9 16.8V29l-3 3H18l-3-3v-7.2C15 14.4 18.4 8.6 24 5Z"
          fill="url(#hmb-rocket-body)"
        />
        <circle cx="24" cy="19" r="3.4" fill="#0ea5e9" />
        <circle cx="24" cy="19" r="3.4" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.9" />
        <path d="M15 25l-5 6 7-1.5V26l-2-1Z" fill="#ffffff" opacity="0.85" />
        <path d="M33 25l5 6-7-1.5V26l2-1Z" fill="#ffffff" opacity="0.85" />
        <path
          d="M20 32h8l-2 7-2 3-2-3-2-7Z"
          fill="url(#hmb-rocket-flame)"
        />
        <path d="M38 10l1.2 2.6L42 14l-2.8 1.4L38 18l-1.2-2.6L34 14l2.8-1.4L38 10Z" fill="#ffffff" />
        <circle cx="9" cy="13" r="1.2" fill="#ffffff" opacity="0.8" />
        <circle cx="40" cy="30" r="1" fill="#ffffff" opacity="0.7" />
      </svg>
    </div>
  )
}

export function Logo({ size = 56, withText = true, tagline = true, className }: LogoProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <LogoMark size={size} />
      {withText && (
        <div className="text-center">
          <div className="text-2xl font-extrabold tracking-tight">
            <span className="text-foreground">Hire</span>
            <span className="text-primary">Me</span>
            <span className="text-foreground">Bot</span>
          </div>
          {tagline && (
            <div className="text-xs font-medium bg-gradient-to-r from-indigo-500 via-primary to-fuchsia-500 bg-clip-text text-transparent mt-0.5">Launch your dream career.</div>
          )}
        </div>
      )}
    </div>
  )
}

export function LogoRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LogoMark size={32} />
      <span className="text-lg font-extrabold tracking-tight">
        <span className="text-foreground">Hire</span>
        <span className="text-primary">Me</span>
        <span className="text-foreground">Bot</span>
      </span>
    </div>
  )
}
