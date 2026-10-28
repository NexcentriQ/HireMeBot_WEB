/**
 * Compact, inline SVG of a graduate silhouette on a mountain, used on the
 * Google-connection screen. Intentionally stylized rather than photographic
 * so it tints correctly in dark mode.
 */
export function GraduateIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="mountainGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(214 95% 85%)" />
          <stop offset="100%" stopColor="hsl(221 83% 60%)" />
        </linearGradient>
      </defs>
      <path d="M0 110 L45 70 L75 95 L110 55 L150 85 L200 60 L200 140 L0 140 Z" fill="url(#mountainGrad)" opacity="0.75" />
      {/* body */}
      <path
        d="M90 95 Q100 75 115 80 L120 110 L95 112 Z"
        fill="hsl(221 83% 45%)"
      />
      {/* head */}
      <circle cx="104" cy="68" r="8" fill="hsl(28 60% 70%)" />
      {/* graduation cap */}
      <path d="M90 60 L120 60 L104 54 Z" fill="#1e293b" />
      <rect x="100" y="60" width="8" height="2" fill="#1e293b" />
      <path d="M108 61 L116 68" stroke="#1e293b" strokeWidth="1.2" fill="none" />
      <circle cx="117" cy="69" r="1.6" fill="#facc15" />
      {/* backpack strap */}
      <path d="M93 85 L92 110" stroke="hsl(221 83% 35%)" strokeWidth="2" />
    </svg>
  )
}
