import { describe, expect, it } from 'vitest'

import { formatSize } from '../format-utils'

describe('formatSize', () => {
  it('returns "0 Bytes" for zero', () => {
    expect(formatSize(0)).toBe('0 Bytes')
  })

  it('formats bytes (< 1024)', () => {
    expect(formatSize(500)).toBe('500 Bytes')
  })

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1 KB')
  })

  it('formats megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1 MB')
  })

  it('formats gigabytes', () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('formats terabytes', () => {
    expect(formatSize(1024 ** 4)).toBe('1 TB')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatSize(1536)).toBe('1.5 KB')
  })

  it('handles non-round values', () => {
    expect(formatSize(1200)).toBe('1.17 KB')
  })
})
