import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  convertToPdf,
  isConvertibleToPdf,
  isPdfMimeType
} from '../document-conversion'

describe('isPdfMimeType', () => {
  it('returns true for application/pdf', () => {
    expect(isPdfMimeType('application/pdf')).toBe(true)
  })

  it('returns false for non-PDF mime types', () => {
    expect(isPdfMimeType('application/msword')).toBe(false)
    expect(isPdfMimeType('image/png')).toBe(false)
  })
})

describe('isConvertibleToPdf', () => {
  it('returns true for modern Word documents (.docx)', () => {
    expect(
      isConvertibleToPdf(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(true)
  })

  it('returns true for legacy Word documents (.doc)', () => {
    expect(isConvertibleToPdf('application/msword')).toBe(true)
  })

  it('returns false for PDF and unrelated mime types', () => {
    expect(isConvertibleToPdf('application/pdf')).toBe(false)
    expect(isConvertibleToPdf('image/png')).toBe(false)
    expect(isConvertibleToPdf('text/plain')).toBe(false)
  })
})

describe('convertToPdf', () => {
  beforeEach(() => {
    process.env.GOTENBERG_URL = 'http://gotenberg:3000'
  })

  afterEach(() => {
    delete process.env.GOTENBERG_URL
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('throws when GOTENBERG_URL is not configured', async () => {
    delete process.env.GOTENBERG_URL
    await expect(
      convertToPdf(Buffer.from('doc bytes'), 'policy.docx')
    ).rejects.toThrow('GOTENBERG_URL')
  })

  it('posts the file to the Gotenberg LibreOffice conversion route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4').buffer
    })
    vi.stubGlobal('fetch', mockFetch)

    await convertToPdf(Buffer.from('doc bytes'), 'policy.docx')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://gotenberg:3000/forms/libreoffice/convert')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.headers).toBeUndefined()
  })

  it('adds a Basic auth header when credentials are configured', async () => {
    process.env.GOTENBERG_BASIC_AUTH_USERNAME = 'gotenberg-user'
    process.env.GOTENBERG_BASIC_AUTH_PASSWORD = 'gotenberg-pass'
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4').buffer
    })
    vi.stubGlobal('fetch', mockFetch)

    await convertToPdf(Buffer.from('doc bytes'), 'policy.docx')

    const [, init] = mockFetch.mock.calls[0]
    const expected = `Basic ${Buffer.from('gotenberg-user:gotenberg-pass').toString('base64')}`
    expect(init.headers).toEqual({ Authorization: expected })

    delete process.env.GOTENBERG_BASIC_AUTH_USERNAME
    delete process.env.GOTENBERG_BASIC_AUTH_PASSWORD
  })

  it('returns the converted PDF as a Buffer on success', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake pdf content')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer
      })
    )

    const result = await convertToPdf(Buffer.from('doc bytes'), 'policy.docx')

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.toString()).toBe('%PDF-1.4 fake pdf content')
  })

  it('throws a descriptive error when Gotenberg returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'conversion failed: unsupported format'
      })
    )

    await expect(
      convertToPdf(Buffer.from('doc bytes'), 'policy.docx')
    ).rejects.toThrow(/500/)
  })

  it('propagates a network failure from fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(
      convertToPdf(Buffer.from('doc bytes'), 'policy.docx')
    ).rejects.toThrow('ECONNREFUSED')
  })
})
