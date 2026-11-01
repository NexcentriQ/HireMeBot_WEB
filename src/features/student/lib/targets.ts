/**
 * Daily and monthly application-target math for the Student Dashboard.
 *
 * All computations are done in the LOCAL calendar — the backend/aggregator is
 * expected to bucket days using the student's configured timezone and surface
 * already-bucketed values. V1 excludes weekends only; holidays are not
 * considered.
 */

export const APPLICATIONS_PER_WEEKDAY = 50

export type DailyTarget = {
  isWeekend: boolean
  target: number
  submitted: number
  remaining: number
  percent: number
}

export type MonthlyTarget = {
  weekdays: number
  target: number
  submitted: number
  remaining: number
  percent: number
}

/** True for Monday..Friday in local time. */
export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

/**
 * Count the Monday–Friday days in `year` / `monthIndex` (0-11).
 * Uses local calendar dates.
 */
export function countWeekdaysInMonth(year: number, monthIndex: number): number {
  let count = 0
  // JS Date rolls over day 0 of next month to last day of previous.
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  for (let d = 1; d <= lastDay; d++) {
    if (isWeekday(new Date(year, monthIndex, d))) count++
  }
  return count
}

export function monthlyTargetFor(year: number, monthIndex: number): number {
  return countWeekdaysInMonth(year, monthIndex) * APPLICATIONS_PER_WEEKDAY
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(100, value)
}

export function remainingFor(target: number, submitted: number): number {
  return Math.max(0, target - submitted)
}

export function percentFor(target: number, submitted: number): number {
  if (target <= 0) return 0
  return clampPercent((submitted / target) * 100)
}

export function roundPercentForDisplay(value: number): number {
  return Math.round(value)
}

export function computeDailyTarget(date: Date, submittedToday: number): DailyTarget {
  const weekend = !isWeekday(date)
  const target = weekend ? 0 : APPLICATIONS_PER_WEEKDAY
  const remaining = remainingFor(target, submittedToday)
  const percent = percentFor(target, submittedToday)
  return { isWeekend: weekend, target, submitted: submittedToday, remaining, percent }
}

export function computeMonthlyTarget(
  year: number,
  monthIndex: number,
  submittedThisMonth: number
): MonthlyTarget {
  const weekdays = countWeekdaysInMonth(year, monthIndex)
  const target = weekdays * APPLICATIONS_PER_WEEKDAY
  return {
    weekdays,
    target,
    submitted: submittedThisMonth,
    remaining: remainingFor(target, submittedThisMonth),
    percent: percentFor(target, submittedThisMonth)
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/**
 * Accepts the server's `monthlyProgress.month` string ("YYYY-MM") and
 * renders it as a human-readable label like "October 2026". Returns the raw
 * input when it does not parse so a bad server value never shows as blank.
 */
export function monthLabelFromIso(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym)
  if (!match) return ym
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return ym
  return monthLabel(year, monthIndex)
}
