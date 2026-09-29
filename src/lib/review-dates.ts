// Pure, client-safe helpers for template review dates (2.2)
import { computeValidUntil } from './completion-validity'

export const DEFAULT_REVIEW_MONTHS = 12
export const REVIEW_DUE_SOON_DAYS = 30
// Days before the review date on which the owner is emailed (0 = the day itself)
export const REVIEW_REMINDER_DAYS = [30, 7, 0] as const

export type ReviewStatus = 'ok' | 'due-soon' | 'overdue'

export const MIN_REVIEW_MONTHS = 1
export const MAX_REVIEW_MONTHS = 120
export const REVIEW_PERIOD_OPTIONS_MONTHS = [3, 6, 12, 24, 36] as const

export function isValidReviewPeriod(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_REVIEW_MONTHS &&
    value <= MAX_REVIEW_MONTHS
  )
}

export function computeReviewDueAt(
  from: Date = new Date(),
  months: number = DEFAULT_REVIEW_MONTHS
): Date {
  return computeValidUntil(from, months)
}

function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function daysUntilReview(
  reviewDueAt: Date | string,
  today: Date = new Date()
): number {
  return Math.round(
    (utcDayMs(new Date(reviewDueAt)) - utcDayMs(today)) / 86_400_000
  )
}

export function getReviewStatus(
  reviewDueAt: Date | string | null | undefined,
  today: Date = new Date()
): ReviewStatus | null {
  if (!reviewDueAt) return null
  const days = daysUntilReview(reviewDueAt, today)
  if (days < 0) return 'overdue'
  if (days <= REVIEW_DUE_SOON_DAYS) return 'due-soon'
  return 'ok'
}

// True when a review reminder should go out now. Milestones are 30, 7 and 0
// days before the review date; the latest milestone reached is sent once, so a
// missed cron run catches up the next day. Once overdue, it repeats weekly.
export function isReviewReminderDue(
  reviewDueAt: Date,
  lastReminderAt: Date | null,
  now: Date
): boolean {
  const days = daysUntilReview(reviewDueAt, now)
  const reached = REVIEW_REMINDER_DAYS.filter((n) => days <= n)
  if (reached.length === 0) return false

  const milestone = Math.min(...reached)
  const milestoneDayMs = utcDayMs(reviewDueAt) - milestone * 86_400_000
  if (!lastReminderAt || lastReminderAt.getTime() < milestoneDayMs) return true

  return days < 0 && now.getTime() - lastReminderAt.getTime() >= 7 * 86_400_000
}
