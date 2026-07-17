import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as uploadSubmission } from '../customer/assignments/[id]/upload-submission/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetWithTemplate } = vi.hoisted(() => ({
  mockGetWithTemplate: vi.fn()
}))
vi.mock('@/lib/assignments', () => ({
  getAssignmentWithTemplate: mockGetWithTemplate
}))

const { mockUploadSourceDocument } = vi.hoisted(() => ({
  mockUploadSourceDocument: vi.fn()
}))
vi.mock('@/lib/document-upload', () => ({
  uploadSourceDocument: mockUploadSourceDocument
}))

const CUSTOMER_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer User'],
    customerCompanyId: 'company_123'
  }
}
const ADMIN_SESSION = {
  user: { id: 'admin_123', roles: ['Tenant Admin'], customerCompanyId: null }
}

const FILL_AND_RETURN_ASSIGNMENT = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  template: {
    id: 'template_123',
    title: 'Return to Work Form',
    sourceType: 'upload',
    uploadMode: 'fill-and-return',
    sourceDocBlobPath: 'templates/template_123/source.pdf',
    sourceDocFileName: 'Return to Work Form.docx'
  }
}

const READ_ONLY_ASSIGNMENT = {
  ...FILL_AND_RETURN_ASSIGNMENT,
  template: {
    ...FILL_AND_RETURN_ASSIGNMENT.template,
    uploadMode: 'read-only'
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function multipartRequest(
  assignmentId: string,
  fields: Record<string, string | File>
): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  return new NextRequest(
    new URL(
      `/api/customer/assignments/${assignmentId}/upload-submission`,
      'http://localhost'
    ),
    { method: 'POST', body: form }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetWithTemplate.mockResolvedValue(FILL_AND_RETURN_ASSIGNMENT)
})

describe('POST /api/customer/assignments/[id]/upload-submission', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role (not a customer)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(null)
    const req = multipartRequest('missing', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue({
      ...FILL_AND_RETURN_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when the template is not fill-and-return', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(READ_ONLY_ASSIGNMENT)
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const req = multipartRequest('assignment_123', {})
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds the size limit', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    const big = new Uint8Array(11 * 1024 * 1024)
    const req = multipartRequest('assignment_123', {
      file: new File([big], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/10MB/)
  })

  it('returns 400 when the file type is unsupported', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockUploadSourceDocument.mockRejectedValue(
      new Error('Unsupported file type: image/png')
    )
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'photo.png', { type: 'image/png' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(400)
  })

  it('returns 500 when conversion fails', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockUploadSourceDocument.mockRejectedValue(
      new Error('Document conversion failed (500 Internal Server Error)')
    )
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(500)
  })

  it('returns 200 with the blob paths and filename on success', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockUploadSourceDocument.mockResolvedValue({
      blobPath:
        'assignment-submissions/assignment_123/user_123-2026-01-01T00-00-00-000Z/source.pdf',
      originalBlobPath: null,
      fileName: 'completed.pdf'
    })
    const req = multipartRequest('assignment_123', {
      file: new File(['x'], 'completed.pdf', { type: 'application/pdf' })
    })
    const res = await uploadSubmission(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileName).toBe('completed.pdf')
    expect(body.blobPath).toMatch(/^assignment-submissions\//)
    expect(mockUploadSourceDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'completed.pdf',
        mimeType: 'application/pdf',
        pathPrefix: expect.stringMatching(
          /^assignment-submissions\/assignment_123\/user_123-/
        )
      })
    )
  })
})
