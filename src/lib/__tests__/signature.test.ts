import { describe, expect, it } from 'vitest'

import { isValidSignatureDataUrl } from '../signature'

const VALID = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'

describe('isValidSignatureDataUrl', () => {
  it('accepts a well-formed PNG data URL', () => {
    expect(isValidSignatureDataUrl(VALID)).toBe(true)
  })

  it('rejects non-string values', () => {
    expect(isValidSignatureDataUrl(undefined)).toBe(false)
    expect(isValidSignatureDataUrl(null)).toBe(false)
    expect(isValidSignatureDataUrl(123)).toBe(false)
    expect(isValidSignatureDataUrl({})).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidSignatureDataUrl('')).toBe(false)
  })

  it('rejects non-PNG data URLs', () => {
    expect(isValidSignatureDataUrl('data:image/jpeg;base64,iVBORw0KGgo=')).toBe(
      false
    )
  })

  it('rejects a plain base64 string with no data URL prefix', () => {
    expect(isValidSignatureDataUrl('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')).toBe(
      false
    )
  })

  it('rejects a data URL with invalid base64 characters', () => {
    expect(
      isValidSignatureDataUrl('data:image/png;base64,not valid base64!!')
    ).toBe(false)
  })

  it('rejects an oversized data URL', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(500_001)
    expect(isValidSignatureDataUrl(huge)).toBe(false)
  })

  it('accepts a data URL right at the size limit', () => {
    const atLimit =
      'data:image/png;base64,' +
      'A'.repeat(500_000 - 'data:image/png;base64,'.length)
    expect(isValidSignatureDataUrl(atLimit)).toBe(true)
  })
})
