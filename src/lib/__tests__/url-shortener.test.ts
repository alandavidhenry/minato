import { describe, expect, it } from 'vitest'

import { generateShortCode } from '../url-shortener'

describe('generateShortCode', () => {
  it('returns a string of the default length (7)', () => {
    expect(generateShortCode()).toHaveLength(7)
  })

  it('returns a string of a custom length', () => {
    expect(generateShortCode(12)).toHaveLength(12)
  })

  it('only contains alphanumeric characters', () => {
    const code = generateShortCode(100)
    expect(code).toMatch(/^[A-Za-z0-9]+$/u)
  })

  it('produces different codes on successive calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
