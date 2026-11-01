import { describe, expect, it } from 'vitest'
import { formatAppliedLong, formatAppliedShort } from '../formatDate'

describe('formatDate', () => {
  it('formats a UTC instant in the America/Chicago reporting zone', () => {
    const iso = '2026-10-29T05:30:00Z' // 00:30 CDT on 2026-10-29
    const text = formatAppliedLong(iso, { timeZone: 'America/Chicago' })
    expect(text).toMatch(/Oct 29, 2026/)
    expect(text).toMatch(/12:30\s*AM/i)
  })

  it('respects the reporting zone when it crosses a day boundary vs the browser', () => {
    const iso = '2026-10-29T02:00:00Z' // Oct 28, 21:00 CDT
    const text = formatAppliedShort(iso, { timeZone: 'America/Chicago' })
    expect(text).toBe('Oct 28, 2026')
  })

  it('falls back to the browser zone when the timeZone is invalid', () => {
    const iso = '2026-10-29T15:30:00Z'
    // "Not/A/Zone" is not a real IANA zone — the helper should still produce
    // *some* non-empty string using the default locale.
    const text = formatAppliedShort(iso, { timeZone: 'Not/A/Zone' })
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns the raw string when the ISO value is unparseable', () => {
    expect(formatAppliedShort('not an iso string', { timeZone: 'UTC' })).toBe(
      'not an iso string'
    )
  })
})
