import { describe, expect, it } from 'vitest'
import {
  computeDailyTarget,
  computeMonthlyTarget,
  countWeekdaysInMonth,
  isWeekday,
  monthlyTargetFor,
  percentFor,
  remainingFor
} from '../targets'

describe('targets utility', () => {
  describe('countWeekdaysInMonth', () => {
    it('October 2026 has 22 weekdays (1,100 target)', () => {
      expect(countWeekdaysInMonth(2026, 9)).toBe(22)
      expect(monthlyTargetFor(2026, 9)).toBe(1100)
    })

    it('February 2024 (leap year) has 21 weekdays', () => {
      expect(countWeekdaysInMonth(2024, 1)).toBe(21)
      expect(monthlyTargetFor(2024, 1)).toBe(1050)
    })

    it('February 2025 (non-leap) has 20 weekdays', () => {
      expect(countWeekdaysInMonth(2025, 1)).toBe(20)
      expect(monthlyTargetFor(2025, 1)).toBe(1000)
    })

    it('January 2026 has 22 weekdays', () => {
      expect(countWeekdaysInMonth(2026, 0)).toBe(22)
    })

    it('March 2024 has 21 weekdays', () => {
      expect(countWeekdaysInMonth(2024, 2)).toBe(21)
    })
  })

  describe('isWeekday', () => {
    it('Monday is a weekday', () => {
      expect(isWeekday(new Date(2026, 9, 26))).toBe(true) // Oct 26, 2026 Mon
    })
    it('Saturday is not a weekday', () => {
      expect(isWeekday(new Date(2026, 9, 24))).toBe(false) // Oct 24, 2026 Sat
    })
    it('Sunday is not a weekday', () => {
      expect(isWeekday(new Date(2026, 9, 25))).toBe(false) // Oct 25, 2026 Sun
    })
  })

  describe('remainingFor', () => {
    it('clamps at zero when over target', () => {
      expect(remainingFor(50, 70)).toBe(0)
    })
    it('returns delta when under', () => {
      expect(remainingFor(50, 35)).toBe(15)
    })
  })

  describe('percentFor', () => {
    it('returns 0 when target is zero', () => {
      expect(percentFor(0, 10)).toBe(0)
    })
    it('clamps display to 100 even when over', () => {
      expect(percentFor(50, 70)).toBe(100)
    })
    it('computes the ratio', () => {
      expect(percentFor(50, 35)).toBe(70)
    })
  })

  describe('computeDailyTarget', () => {
    it('on a weekday reports target 50 and remaining 15 at 35 submitted', () => {
      const result = computeDailyTarget(new Date(2026, 9, 26), 35) // Mon
      expect(result).toMatchObject({
        isWeekend: false,
        target: 50,
        submitted: 35,
        remaining: 15,
        percent: 70
      })
    })

    it('on a Saturday reports target 0 and no remaining', () => {
      const result = computeDailyTarget(new Date(2026, 9, 24), 12) // Sat
      expect(result).toMatchObject({
        isWeekend: true,
        target: 0,
        remaining: 0,
        percent: 0
      })
    })
  })

  describe('computeMonthlyTarget', () => {
    it('October 2026 at 820 submitted → 280 remaining, 75% rounded', () => {
      const r = computeMonthlyTarget(2026, 9, 820)
      expect(r.target).toBe(1100)
      expect(r.remaining).toBe(280)
      expect(Math.round(r.percent)).toBe(75)
    })

    it('clamps progress when submitted exceeds target', () => {
      const r = computeMonthlyTarget(2026, 9, 1500)
      expect(r.submitted).toBe(1500)
      expect(r.remaining).toBe(0)
      expect(r.percent).toBe(100)
    })
  })
})
