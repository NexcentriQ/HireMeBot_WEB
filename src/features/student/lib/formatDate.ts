/**
 * Timezone-aware timestamp formatters. The backend's `appliedAt` is an
 * ISO-8601 instant with the reporting-zone offset; we render it in the same
 * zone the server used to bucket statistics so the day shown on the UI
 * matches the day the server counts the application under.
 *
 * When `timeZone` is missing (first paint before the dashboard loads, or in
 * a code path that genuinely has no reporting zone), we fall back to the
 * browser's locale rather than throwing.
 */

type ShortOpts = { timeZone?: string }

const SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}

const LONG_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
}

function format(iso: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const opts: Intl.DateTimeFormatOptions = timeZone ? { ...options, timeZone } : options
  try {
    return new Intl.DateTimeFormat('en-US', opts).format(d)
  } catch {
    // Guard against an unrecognized IANA zone — fall back to browser locale.
    return new Intl.DateTimeFormat('en-US', options).format(d)
  }
}

export function formatAppliedShort(iso: string, { timeZone }: ShortOpts = {}): string {
  return format(iso, timeZone, SHORT_OPTIONS)
}

export function formatAppliedLong(iso: string, { timeZone }: ShortOpts = {}): string {
  return format(iso, timeZone, LONG_OPTIONS)
}
