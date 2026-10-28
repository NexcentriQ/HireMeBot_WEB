import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { companySlugFor } from '../data/studentService'

/**
 * Lightweight inline company-logo renderer. Avoids depending on remote image
 * sources; well-known HireMeBot sample companies render a stylized monogram
 * using their brand color, and anything else falls back to a neutral icon.
 *
 * `slug` is derived from the company name when the caller omits it, which
 * matches the backend contract (no `companySlug` field is returned).
 */

type CompanyLogoProps = {
  name: string
  slug?: string
  size?: number
  className?: string
}

const BRANDS: Record<string, { bg: string; fg: string; letters?: string; shape?: 'square' | 'circle' }> = {
  amazon: { bg: '#ffffff', fg: '#111827', letters: 'a' },
  microsoft: { bg: '#ffffff', fg: '#111827' },
  google: { bg: '#ffffff', fg: '#4285F4', letters: 'G' },
  meta: { bg: '#ffffff', fg: '#1877F2', letters: '∞' },
  apple: { bg: '#ffffff', fg: '#111827', letters: '' },
  netflix: { bg: '#000000', fg: '#E50914', letters: 'N' },
  stripe: { bg: '#635BFF', fg: '#ffffff', letters: 'S' },
  salesforce: { bg: '#00A1E0', fg: '#ffffff', letters: 'sf' },
  oracle: { bg: '#F80000', fg: '#ffffff', letters: 'O' },
  ibm: { bg: '#1F70C1', fg: '#ffffff', letters: 'IBM' }
}

function MicrosoftTiles({ size }: { size: number }) {
  const s = size * 0.42
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="0" y="0" width="9" height="9" fill="#F25022" />
      <rect x="11" y="0" width="9" height="9" fill="#7FBA00" />
      <rect x="0" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

function AppleGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" aria-hidden="true" fill={color}>
      <path d="M16.365 1.43c0 1.14-.47 2.27-1.23 3.07-.81.87-2.09 1.52-3.14 1.44-.13-1.1.47-2.25 1.18-2.99.8-.87 2.17-1.5 3.19-1.52zm3.35 16.33c-.56 1.31-.83 1.9-1.56 3.06-1.02 1.63-2.46 3.66-4.25 3.67-1.59.01-2-1.04-4.16-1.03-2.16.01-2.61 1.05-4.21 1.03-1.79-.02-3.15-1.85-4.17-3.47C-1.43 17.92-1.68 12.9.7 10.14c1.24-1.44 3.19-2.35 5.03-2.35 1.87 0 3.06 1.03 4.6 1.03 1.5 0 2.42-1.03 4.59-1.03 1.64 0 3.37.89 4.6 2.43-4.05 2.22-3.39 8.01 1.19 9.54z"/>
    </svg>
  )
}

export function CompanyLogo({ name, slug, size = 44, className }: CompanyLogoProps) {
  const effectiveSlug = (slug ?? companySlugFor(name)).toLowerCase()
  const brand = BRANDS[effectiveSlug]

  if (!brand) {
    return (
      <div
        className={cn('inline-flex items-center justify-center rounded-xl bg-muted text-muted-foreground', className)}
        style={{ width: size, height: size }}
        aria-label={name}
      >
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
    )
  }

  const shape = brand.shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div
      className={cn('inline-flex items-center justify-center border border-border/40', shape, className)}
      style={{ width: size, height: size, background: brand.bg }}
      role="img"
      aria-label={name}
    >
      {effectiveSlug === 'microsoft' ? (
        <MicrosoftTiles size={size} />
      ) : effectiveSlug === 'apple' ? (
        <AppleGlyph size={size} color={brand.fg} />
      ) : (
        <span
          className="font-extrabold leading-none"
          style={{ color: brand.fg, fontSize: size * (brand.letters && brand.letters.length > 1 ? 0.4 : 0.55) }}
        >
          {brand.letters ?? name[0]}
        </span>
      )}
    </div>
  )
}
