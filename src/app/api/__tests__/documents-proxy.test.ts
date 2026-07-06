import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as proxyDocument } from '../documents/proxy/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(),
  ActivityType: { VIEW: 'view' }
}))

const ALLOWED_HOST = 'ststdocumentportaldevdev.blob.core.windows.net'

describe('GET /api/documents/proxy', () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' }
    })
    process.env.AZURE_STORAGE_PROXY_HOST = ALLOWED_HOST
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
        headers: new Headers({ 'content-type': 'application/pdf' })
      })
    )
  })

  afterEach(() => {
    delete process.env.AZURE_STORAGE_PROXY_HOST
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('forwards the query string byte-for-byte, preserving %20 in signed SAS params', async () => {
    // rscd (Content-Disposition) is part of the signed SAS string — re-serializing
    // it through URLSearchParams turns spaces into '+' and breaks the signature.
    const sasUrl =
      `https://${ALLOWED_HOST}/documents/customers/acme-construction/` +
      `Completed%20Forms/Accident%20%26%20Incident%20Report.pdf` +
      `?sv=2026-06-06&spr=https&se=2026-07-06T21%3A26%3A32Z&sr=b&sp=r` +
      `&rscd=attachment%3B%20filename%3D%22Accident%20%26%20Incident%20Report.pdf%22` +
      `&sig=qHxvGFpKkvMzlPrnRXykcs4biB7XeepdcDS0sur04nE%3D`

    const request = new NextRequest(
      `http://localhost/api/documents/proxy?url=${encodeURIComponent(sasUrl)}`
    )

    const response = await proxyDocument(request)

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
    const fetchedUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(fetchedUrl.toString()).toBe(sasUrl)
  })

  it('rejects a URL whose host is not the allow-listed storage host', async () => {
    const request = new NextRequest(
      `http://localhost/api/documents/proxy?url=${encodeURIComponent('https://evil.example.com/documents/file.pdf')}`
    )

    const response = await proxyDocument(request)

    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
