import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as uploadDocument } from '../admin/templates/upload-document/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockUploadSourceDocument } = vi.hoisted(() => ({
  mockUploadSourceDocument: vi.fn()
}))
vi.mock('@/lib/document-upload', () => ({
  uploadSourceDocument: mockUploadSourceDocument
}))

const ADMIN_SESSION = { user: { id: 'admin_123', roles: ['Tenant Admin'] } }
const CUSTOMER_SESSION = { user: { id: 'user_123', roles: ['Customer User'] } }

function multipartRequest(fields: Record<string, string | File>): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  return new NextRequest(
    new URL('/api/admin/templates/upload-document', 'http://localhost'),
    { method: 'POST', body: form }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/admin/templates/upload-document', () => {
  it('returns 403 for non-admin roles', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const req = multipartRequest({
      file: new File(['x'], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when file is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = multipartRequest({})
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds the size limit', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const big = new Uint8Array(11 * 1024 * 1024)
    const req = multipartRequest({
      file: new File([big], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/10MB/)
  })

  it('returns 400 when the file type is unsupported', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockUploadSourceDocument.mockRejectedValue(
      new Error('Unsupported file type: image/png')
    )
    const req = multipartRequest({
      file: new File(['x'], 'photo.png', { type: 'image/png' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when conversion fails', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockUploadSourceDocument.mockRejectedValue(
      new Error('Document conversion failed (500 Internal Server Error)')
    )
    const req = multipartRequest({
      file: new File(['x'], 'policy.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(500)
  })

  it('returns 200 with the blob paths and filename on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockUploadSourceDocument.mockResolvedValue({
      blobPath: 'template-uploads/2026-01-01T00-00-00-000Z/source.pdf',
      originalBlobPath: null,
      fileName: 'policy.pdf'
    })
    const req = multipartRequest({
      file: new File(['x'], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileName).toBe('policy.pdf')
    expect(body.blobPath).toMatch(/^template-uploads\//)
    expect(body.originalBlobPath).toBeNull()
    expect(mockUploadSourceDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'policy.pdf',
        mimeType: 'application/pdf',
        pathPrefix: expect.stringMatching(/^template-uploads\//)
      })
    )
  })
})
