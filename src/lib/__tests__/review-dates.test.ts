import { describe, expect, it } from 'vitest'

import {
  computeReviewDueAt,
  daysUntilReview,
  getReviewStatus,
  isReviewReminderDue,
  isValidReviewPeriod
} from '../review-dates'

const TODAY = new Date('2026-09-30T09:00:00Z')

describe('computeReviewDueAt', () => {
  it('is 12 months after the given date, clamping month end', () => {
    expect(
      computeReviewDueAt(new Date('2026-09-30T00:00:00Z')).toISOString()
    ).toBe('2027-09-30T00:00:00.000Z')
    expect(
      computeReviewDueAt(new Date('2028-02-29T00:00:00Z')).toISOString()
    ).toBe('2029-02-28T00:00:00.000Z')
  })
})

describe('computeReviewDueAt with a custom period', () => {
  it('uses the given number of months', () => {
    expect(
      computeReviewDueAt(new Date('2026-09-30T00:00:00Z'), 6).toISOString()
    ).toBe('2027-03-30T00:00:00.000Z')
  })
})

describe('isValidReviewPeriod', () => {
  it.each([1, 6, 12, 120])('accepts %s', (v) => {
    expect(isValidReviewPeriod(v)).toBe(true)
  })
  it.each([0, -1, 121, 1.5, '12', null, undefined])('rejects %s', (v) => {
    expect(isValidReviewPeriod(v)).toBe(false)
  })
})

describe('daysUntilReview', () => {
  it('counts whole UTC days, ignoring time of day', () => {
    expect(daysUntilReview('2026-10-30T23:00:00Z', TODAY)).toBe(30)
    expect(daysUntilReview('2026-09-29T01:00:00Z', TODAY)).toBe(-1)
  })
})

describe('getReviewStatus', () => {
  it('returns null without a date', () => {
    expect(getReviewStatus(null, TODAY)).toBeNull()
  })
  it('is ok beyond 30 days', () => {
    expect(getReviewStatus('2026-11-01T00:00:00Z', TODAY)).toBe('ok')
  })
  it('is due-soon from 30 days out through the day itself', () => {
    expect(getReviewStatus('2026-10-30T00:00:00Z', TODAY)).toBe('due-soon')
    expect(getReviewStatus('2026-09-30T00:00:00Z', TODAY)).toBe('due-soon')
  })
  it('is overdue once the date has passed', () => {
    expect(getReviewStatus('2026-09-29T00:00:00Z', TODAY)).toBe('overdue')
  })
})

describe('isReviewReminderDue', () => {
  const due = (iso: string, last: string | null, now = TODAY) =>
    isReviewReminderDue(new Date(iso), last ? new Date(last) : null, now)

  it('is false before the 30-day milestone', () => {
    expect(due('2026-11-01T00:00:00Z', null)).toBe(false)
  })

  it.each([
    ['2026-10-30T00:00:00Z'],
    ['2026-10-07T00:00:00Z'],
    ['2026-09-30T00:00:00Z']
  ])('fires on a milestone day (%s) when nothing was sent yet', (date) => {
    expect(due(date, null)).toBe(true)
  })

  it('does not repeat once the current milestone has been sent', () => {
    // 7 days out; 7-day milestone day was 2026-09-30, sent that morning
    expect(due('2026-10-07T00:00:00Z', '2026-09-30T08:00:00Z')).toBe(false)
  })

  it('catches up a missed milestone the next day', () => {
    // 6 days out: the 7-day milestone was missed, last sent at the 30-day mark
    expect(due('2026-10-06T00:00:00Z', '2026-09-06T08:00:00Z')).toBe(true)
  })

  it('moves to the next milestone after the previous was sent', () => {
    expect(due('2026-09-30T00:00:00Z', '2026-09-23T08:00:00Z')).toBe(true)
  })

  it('repeats weekly once overdue', () => {
    const now = new Date('2026-10-14T09:00:00Z')
    expect(due('2026-09-30T00:00:00Z', '2026-10-01T09:00:00Z', now)).toBe(true)
    expect(due('2026-09-30T00:00:00Z', '2026-10-10T09:00:00Z', now)).toBe(false)
  })
})
