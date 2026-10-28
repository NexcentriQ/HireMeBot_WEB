import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useResendCountdown } from '../hooks/useResendCountdown'

describe('useResendCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down to zero and stops', () => {
    const { result } = renderHook(() => useResendCountdown(3))
    expect(result.current.remaining).toBe(3)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.remaining).toBe(2)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.remaining).toBe(0)
  })

  it('restarts when start() is called', () => {
    const { result } = renderHook(() => useResendCountdown(2))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.remaining).toBe(0)
    act(() => {
      result.current.start(5)
    })
    expect(result.current.remaining).toBe(5)
  })
})
