import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as uploadFile } from '../customer/assignments/[id]/upload-file/route'

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

const { mockUploadData } = vi.hoisted(() => ({
  mockUploadData: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: () => ({
      getContainerClient: () => ({
        getBlockBlobClient: () => ({ uploadData: mockUploadData })
      })
    })
  }
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

const ASSIGNMENT_WITH_FILE_FIELD = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  userId: null,
  template: {
    id: 'template_123',
    title: 'Risk Assessment',
    description: null,
    blobPath: null,
    formSchema: [
      { id: 'photo', label: 'Hazard photo', type: 'file', required: true },
      { id: 'name', label: 'Name', type: 'text', required: true }
    ]
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function multipartRequest(
  url: string,
  fields: Record<string, string | File>
): NextRequest {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    body: form
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetWithTemplate.mockResolvedValue(null)
  mockUploadData.mockResolvedValue(undefined)
})

describe('POST /api/customer/assignments/[id]/upload-file', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      {
        file: new File(['x'], 'photo.png', { type: 'image/png' }),
        fieldId: 'photo'
      }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      { file: new File(['x'], 'photo.png'), fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(null)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/missing/upload-file',
      { file: new File(['x'], 'photo.png'), fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue({
      ...ASSIGNMENT_WITH_FILE_FIELD,
      customerCompanyId: 'other_company'
    })
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      { file: new File(['x'], 'photo.png'), fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when file is missing', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_FILE_FIELD)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      { fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when fieldId does not reference a file field', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_FILE_FIELD)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      { file: new File(['x'], 'photo.png'), fieldId: 'name' }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds the size limit', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_FILE_FIELD)
    const big = new Uint8Array(11 * 1024 * 1024)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      { file: new File([big], 'big.png'), fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/10MB/)
  })

  it('returns 200 with blobPath and fileName on success', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_FILE_FIELD)
    const req = multipartRequest(
      'http://localhost/api/customer/assignments/assignment_123/upload-file',
      {
        file: new File(['hazard'], 'hazard.png', { type: 'image/png' }),
        fieldId: 'photo'
      }
    )
    const res = await uploadFile(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileName).toBe('hazard.png')
    expect(body.blobPath).toMatch(
      /^form-uploads\/assignment_123\/user_123\/photo-/
    )
    expect(mockUploadData).toHaveBeenCalledOnce()
  })
})
