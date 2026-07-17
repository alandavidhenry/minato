import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as uploadDocument } from '../customer/admin/templates/upload-document/route'

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

const CUSTOMER_ADMIN_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_123'
  }
}
const NO_COMPANY_SESSION = {
  user: { id: 'user_123', roles: ['Customer Admin'], customerCompanyId: null }
}
const CUSTOMER_USER_SESSION = {
  user: {
    id: 'user_456',
    roles: ['Customer User'],
    customerCompanyId: 'company_123'
  }
}

function multipartRequest(fields: Record<string, string | File>): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  return new NextRequest(
    new URL(
      '/api/customer/admin/templates/upload-document',
      'http://localhost'
    ),
    { method: 'POST', body: form }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/customer/admin/templates/upload-document', () => {
  it('returns 403 for non-Customer-Admin roles', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_USER_SESSION)
    const req = multipartRequest({
      file: new File(['x'], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 when the session has no company assigned', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const req = multipartRequest({
      file: new File(['x'], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when file is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    const req = multipartRequest({})
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds the size limit', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    const big = new Uint8Array(11 * 1024 * 1024)
    const req = multipartRequest({
      file: new File([big], 'policy.pdf', { type: 'application/pdf' })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/10MB/)
  })

  it('returns 200 with the blob paths and filename on success', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_ADMIN_SESSION)
    mockUploadSourceDocument.mockResolvedValue({
      blobPath: 'template-uploads/2026-01-01T00-00-00-000Z/source.pdf',
      originalBlobPath:
        'template-uploads/2026-01-01T00-00-00-000Z/source-original-policy.docx',
      fileName: 'policy.docx'
    })
    const req = multipartRequest({
      file: new File(['x'], 'policy.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
    })
    const res = await uploadDocument(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileName).toBe('policy.docx')
    expect(body.originalBlobPath).toMatch(/^template-uploads\//)
  })
})
