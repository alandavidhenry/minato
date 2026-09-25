import { describe, expect, it } from 'vitest'

import { getRetentionEndDate, isWithinRetentionPeriod } from '../data-retention'

describe('getRetentionEndDate', () => {
  it('adds the retention years to the signed date', () => {
    const end = getRetentionEndDate('2024-01-01T00:00:00.000Z', 5)
    expect(end.getUTCFullYear()).toBe(2029)
  })
})

describe('isWithinRetentionPeriod', () => {
  it('returns true when now is before the retention end date', () => {
    const result = isWithinRetentionPeriod(
      '2024-01-01T00:00:00.000Z',
      5,
      new Date('2026-01-01T00:00:00.000Z')
    )
    expect(result).toBe(true)
  })

  it('returns false once the retention period has elapsed', () => {
    const result = isWithinRetentionPeriod(
      '2020-01-01T00:00:00.000Z',
      5,
      new Date('2026-01-01T00:00:00.000Z')
    )
    expect(result).toBe(false)
  })

  it('returns false exactly at the retention end date', () => {
    const result = isWithinRetentionPeriod(
      '2020-01-01T00:00:00.000Z',
      5,
      new Date('2025-01-01T00:00:00.000Z')
    )
    expect(result).toBe(false)
  })

  it('defaults now to the current time when not provided', () => {
    const farFuture = isWithinRetentionPeriod('2020-01-01T00:00:00.000Z', 1)
    expect(farFuture).toBe(false)
  })
})
