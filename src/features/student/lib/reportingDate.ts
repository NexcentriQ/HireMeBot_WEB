import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * IANA-zone date arithmetic for reporting-date rollover handling. We never
 * trust the browser clock's zone — the dashboard belongs to the server's
 * reporting zone, which comes back on each response as `statistics.timezone`.
 */

/** Returns the YYYY-MM-DD string that `now` falls under in `timeZone`. */
export function currentDateInZone(timeZone: string, now: Date = new Date()): string {
  // en-CA produces ISO-style YYYY-MM-DD from Intl.DateTimeFormat.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return fmt.format(now)
}

/**
 * Milliseconds between `now` and the next midnight **in `timeZone`**. Uses
 * `Date#toLocaleString` with the zone to compute the zone offset at the
 * instant in question, which correctly handles DST transitions.
 */
export function msUntilNextMidnightInZone(timeZone: string, now: Date = new Date()): number {
  // Compose a target instant representing "tomorrow 00:00 in timeZone".
  const today = currentDateInZone(timeZone, now)
  const [y, m, d] = today.split('-').map(Number)
  // Build a Date that encodes the local wall-clock midnight of the day
  // AFTER `today`, interpreted in `timeZone`. The trick: compute the zone
  // offset at the current instant and subtract it from a UTC midnight.
  const tomorrowUtcMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)
  // Figure out what UTC time corresponds to "tomorrow 00:00 in timeZone"
  // by taking the offset of the current instant in that zone.
  const nowOffsetMinutes = zoneOffsetMinutes(timeZone, now)
  const target = tomorrowUtcMidnight + nowOffsetMinutes * 60_000
  const delta = target - now.getTime()
  // Guard against negative deltas across the boundary; clamp to >= 1s.
  return Math.max(1000, delta)
}

function zoneOffsetMinutes(timeZone: string, at: Date): number {
  // Format the same instant in UTC and in `timeZone` and diff the wall clock.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  // Positive when the zone is behind UTC (e.g., America/Chicago → +300).
  return (at.getTime() - asUtc) / 60_000
}

/**
 * Side-effect hook: schedule invalidation of the student-dashboard query at
 * the next midnight in `timeZone` AND when the tab regains focus if the
 * reporting day has already rolled over since the cache was taken.
 *
 * Pass the current cached response (or at least the timezone it carried).
 * The hook no-ops when timezone / currentDate are unavailable so it is safe
 * to call during the very first load.
 */
export function useReportingDateInvalidation(args: { timeZone?: string; cachedDate?: string }): void {
  const { timeZone, cachedDate } = args
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!timeZone) return

    function invalidate() {
      // Prefix match — invalidates every ['student-dashboard', <studentId>]
      // entry regardless of which student id it was keyed by.
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })
    }

    // 1) schedule the next-midnight invalidation.
    const delay = msUntilNextMidnightInZone(timeZone)
    const timer = window.setTimeout(invalidate, delay)

    // 2) also invalidate when the tab becomes visible or regains focus if
    //    the zone date has advanced past the cached response's date.
    function maybeInvalidate() {
      if (!cachedDate) return
      if (currentDateInZone(timeZone!) !== cachedDate) invalidate()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeInvalidate()
    }
    window.addEventListener('focus', maybeInvalidate)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', maybeInvalidate)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [queryClient, timeZone, cachedDate])
}
