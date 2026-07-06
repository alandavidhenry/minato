import { describe, expect, it } from 'vitest'

import { buildContentDisposition } from '../content-disposition'

describe('buildContentDisposition', () => {
  it('quotes an ASCII filename as-is in both parameters', () => {
    const result = buildContentDisposition('attachment', 'report.pdf')

    expect(result).toBe(
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`
    )
  })

  it('replaces non-ASCII characters with underscores in the fallback filename', () => {
    const result = buildContentDisposition(
      'attachment',
      'Risk Assessment — Manual Handling.pdf'
    )

    expect(result).toContain('filename="Risk Assessment _ Manual Handling.pdf"')
  })

  it('percent-encodes the UTF-8 filename for the filename* parameter', () => {
    const result = buildContentDisposition(
      'attachment',
      'Risk Assessment — Manual Handling.pdf'
    )

    expect(result).toContain(
      `filename*=UTF-8''Risk%20Assessment%20%E2%80%94%20Manual%20Handling.pdf`
    )
  })

  it('escapes quotes and backslashes in the ASCII fallback', () => {
    const result = buildContentDisposition('inline', 'weird"name\\.pdf')

    expect(result).toContain('filename="weird_name_.pdf"')
  })

  it('supports the inline disposition type', () => {
    const result = buildContentDisposition('inline', 'report.pdf')

    expect(result.startsWith('inline; filename=')).toBe(true)
  })
})
