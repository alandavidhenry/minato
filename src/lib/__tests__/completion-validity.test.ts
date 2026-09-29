import { describe, expect, it } from 'vitest'

import {
  computeValidUntil,
  formatRecurrence,
  getValidityStatus,
  isValidRecurrenceMonths,
  DEFAULT_RENEWAL_LEAD_DAYS,
  isValidRenewalLeadDays
} from '../completion-validity'

describe('computeValidUntil', () => {
  it('adds whole months', () => {
    expect(
      computeValidUntil(new Date('2026-03-15T10:00:00.000Z'), 12).toISOString()
    ).toBe('2027-03-15T10:00:00.000Z')
    expect(
      computeValidUntil(new Date('2026-03-15T10:00:00.000Z'), 6).toISOString()
    ).toBe('2026-09-15T10:00:00.000Z')
  })

  it('clamps to the end of a shorter month', () => {
    expect(
      computeValidUntil(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()
    ).toBe('2026-02-28T00:00:00.000Z')
    expect(
      computeValidUntil(new Date('2024-02-29T00:00:00.000Z'), 12).toISOString()
    ).toBe('2025-02-28T00:00:00.000Z')
  })

  it('does not mutate the input', () => {
    const signedAt = new Date('2026-03-15T10:00:00.000Z')
    computeValidUntil(signedAt, 12)
    expect(signedAt.toISOString()).toBe('2026-03-15T10:00:00.000Z')
  })
})

describe('getValidityStatus', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')

  it('returns null when there is no expiry', () => {
    expect(getValidityStatus(null, now)).toBeNull()
    expect(getValidityStatus(undefined, now)).toBeNull()
  })

  it('is valid beyond the renewal window', () => {
    expect(getValidityStatus('2026-09-01T00:00:00.000Z', now)).toBe('valid')
  })

  it('is expiring soon inside the renewal window, including its edge', () => {
    const edge = new Date(
      now.getTime() + DEFAULT_RENEWAL_LEAD_DAYS * 86_400_000
    )
    expect(getValidityStatus(edge, now)).toBe('expiring-soon')
    expect(getValidityStatus('2026-06-10T00:00:00.000Z', now)).toBe(
      'expiring-soon'
    )
  })

  it('is expired at or after the expiry instant', () => {
    expect(getValidityStatus(now, now)).toBe('expired')
    expect(getValidityStatus('2026-05-01T00:00:00.000Z', now)).toBe('expired')
  })
})

describe('getValidityStatus with a custom lead time', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')

  it('flags expiring soon only inside the supplied window', () => {
    const in20Days = '2026-06-21T00:00:00.000Z'
    expect(getValidityStatus(in20Days, now, 14)).toBe('valid')
    expect(getValidityStatus(in20Days, now, 21)).toBe('expiring-soon')
    expect(getValidityStatus(in20Days, now, 60)).toBe('expiring-soon')
  })

  it('does not change what counts as expired', () => {
    expect(getValidityStatus('2026-05-31T00:00:00.000Z', now, 1)).toBe(
      'expired'
    )
  })
})

describe('isValidRenewalLeadDays', () => {
  it('accepts whole days from 1 to 180', () => {
    for (const v of [1, 30, 180]) expect(isValidRenewalLeadDays(v)).toBe(true)
  })

  it('rejects out-of-range, fractional and non-numbers', () => {
    for (const v of [0, -5, 181, 2.5, '30', null, NaN]) {
      expect(isValidRenewalLeadDays(v)).toBe(false)
    }
  })
})

describe('isValidRecurrenceMonths', () => {
  it('accepts whole months from 1 to 120', () => {
    expect(isValidRecurrenceMonths(1)).toBe(true)
    expect(isValidRecurrenceMonths(12)).toBe(true)
    expect(isValidRecurrenceMonths(120)).toBe(true)
  })

  it('rejects zero, negatives, fractions, oversized and non-numbers', () => {
    for (const v of [0, -3, 1.5, 121, '12', null, undefined, NaN]) {
      expect(isValidRecurrenceMonths(v)).toBe(false)
    }
  })
})

describe('formatRecurrence', () => {
  it('formats years and months', () => {
    expect(formatRecurrence(null)).toBe('Does not repeat')
    expect(formatRecurrence(12)).toBe('Every year')
    expect(formatRecurrence(24)).toBe('Every 2 years')
    expect(formatRecurrence(6)).toBe('Every 6 months')
  })
})
