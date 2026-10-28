import { useTheme } from '@/app/ThemeProvider'

/**
 * Soft layered mountain illustration used at the bottom of auth screens,
 * matching the HireMeBot design references. Light theme uses blue tints;
 * dark theme uses deep navy tones so the shapes remain subtle.
 */
export function MountainBackdrop() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const colors = isDark
    ? { back: '#1e3a8a', mid: '#1d4ed8', front: '#2563eb', frontOpacity: 0.35, midOpacity: 0.28, backOpacity: 0.22 }
    : { back: '#dbeafe', mid: '#bfdbfe', front: '#93c5fd', frontOpacity: 1, midOpacity: 1, backOpacity: 1 }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="w-full h-32 sm:h-40">
        <path
          d="M0 120 Q50 70 110 100 T220 90 T330 110 T400 95 V160 H0 Z"
          fill={colors.back}
          opacity={colors.backOpacity}
        />
        <path
          d="M0 135 Q60 95 130 115 T260 110 T400 125 V160 H0 Z"
          fill={colors.mid}
          opacity={colors.midOpacity}
        />
        <path
          d="M0 150 Q70 125 140 140 T290 135 T400 145 V160 H0 Z"
          fill={colors.front}
          opacity={colors.frontOpacity}
        />
      </svg>
    </div>
  )
}
