import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  currentDateInZone,
  msUntilNextMidnightInZone,
  useReportingDateInvalidation
} from '../reportingDate'
import { studentDashboardKey } from '../../hooks/useStudentDashboard'

describe('reportingDate helpers', () => {
  it('currentDateInZone returns YYYY-MM-DD in the given zone', () => {
    // 2026-10-29T04:30:00Z = 2026-10-28 23:30 America/Chicago (CDT)
    const d = new Date('2026-10-29T04:30:00Z')
    expect(currentDateInZone('America/Chicago', d)).toBe('2026-10-28')
    expect(currentDateInZone('UTC', d)).toBe('2026-10-29')
  })

  it('msUntilNextMidnightInZone returns a positive delta no larger than ~24h', () => {
    const d = new Date('2026-10-29T06:00:00Z') // 01:00 CDT
    const delta = msUntilNextMidnightInZone('America/Chicago', d)
    expect(delta).toBeGreaterThan(0)
    expect(delta).toBeLessThanOrEqual(1000 * 60 * 60 * 25) // ≤ 25h accounts for DST
  })
})

describe('useReportingDateInvalidation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function Harness(args: { timeZone?: string; cachedDate?: string }) {
    useReportingDateInvalidation(args)
    return null
  }

  it('invalidates the student-dashboard query when the midnight timer fires', () => {
    vi.setSystemTime(new Date('2026-10-29T22:00:00Z')) // 17:00 CDT
    const client = new QueryClient()
    client.setQueryData(studentDashboardKey('abc'), { marker: 'before' })
    const spy = vi.spyOn(client, 'invalidateQueries')

    render(
      <QueryClientProvider client={client}>
        <Harness timeZone="America/Chicago" cachedDate="2026-10-29" />
      </QueryClientProvider>
    )

    // Advance well past the next midnight in the zone.
    act(() => {
      vi.advanceTimersByTime(1000 * 60 * 60 * 24)
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['student-dashboard'] })
  })

  it('no-ops when no timeZone is provided (e.g., before the first fetch)', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
    act(() => {
      vi.advanceTimersByTime(1000 * 60 * 60 * 48)
    })
    expect(spy).not.toHaveBeenCalled()
  })
})
