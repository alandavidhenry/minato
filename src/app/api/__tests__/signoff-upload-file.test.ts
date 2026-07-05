import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as uploadFile } from '../signoff/[companyId]/[assignmentId]/upload-file/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetCompanyById } = vi.hoisted(() => ({
  mockGetCompanyById: vi.fn()
}))
vi.mock('@/lib/customer-companies', () => ({
  getCustomerCompanyById: mockGetCompanyById
}))

const { mockGetUserById } = vi.hoisted(() => ({ mockGetUserById: vi.fn() }))
vi.mock('@/lib/user-database', () => ({ getUserById: mockGetUserById }))

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

const COMPANY = { id: 'co_1', name: 'Acme Ltd', folderPath: null }
const WORKER = {
  id: 'worker_1',
  displayName: 'Bob Builder',
  customerCompanyId: 'co_1',
  email: null
}
const ASSIGNMENT_WITH_FILE_FIELD = {
  id: 'assignment_1',
  templateId: 'template_1',
  customerCompanyId: 'co_1',
  userId: null,
  template: {
    id: 'template_1',
    title: 'Risk Assessment',
    description: null,
    blobPath: null,
    formSchema: [
      { id: 'photo', label: 'Hazard photo', type: 'file', required: true }
    ]
  }
}

function params(companyId: string, assignmentId: string) {
  return { params: Promise.resolve({ companyId, assignmentId }) }
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
  mockGetServerSession.mockResolvedValue(null)
  mockGetCompanyById.mockResolvedValue(COMPANY)
  mockGetUserById.mockResolvedValue(WORKER)
  mockGetWithTemplate.mockResolvedValue(ASSIGNMENT_WITH_FILE_FIELD)
  mockUploadData.mockResolvedValue(undefined)
})

describe('POST /api/signoff/[companyId]/[assignmentId]/upload-file', () => {
  it('returns 403 for authenticated users', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'x' } })
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when company not found', async () => {
    mockGetCompanyById.mockResolvedValue(null)
    const req = multipartRequest(
      'http://localhost/api/signoff/missing/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('missing', 'assignment_1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when workerId is missing', async () => {
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(400)
  })

  it('returns 403 when worker has an email (not eligible for kiosk)', async () => {
    mockGetUserById.mockResolvedValue({ ...WORKER, email: 'bob@example.com' })
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(403)
  })

  it('returns 403 when worker belongs to a different company', async () => {
    mockGetUserById.mockResolvedValue({ ...WORKER, customerCompanyId: 'other' })
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetWithTemplate.mockResolvedValue(null)
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when an individual assignment belongs to a different worker', async () => {
    mockGetWithTemplate.mockResolvedValue({
      ...ASSIGNMENT_WITH_FILE_FIELD,
      userId: 'other_worker'
    })
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'photo', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when fieldId does not reference a file field', async () => {
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      { file: new File(['x'], 'a.png'), fieldId: 'nope', workerId: 'worker_1' }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when file exceeds the size limit', async () => {
    const big = new Uint8Array(11 * 1024 * 1024)
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      {
        file: new File([big], 'big.png'),
        fieldId: 'photo',
        workerId: 'worker_1'
      }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with blobPath and fileName on success', async () => {
    const req = multipartRequest(
      'http://localhost/api/signoff/co_1/assignment_1/upload-file',
      {
        file: new File(['hazard'], 'hazard.png', { type: 'image/png' }),
        fieldId: 'photo',
        workerId: 'worker_1'
      }
    )
    const res = await uploadFile(req, params('co_1', 'assignment_1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fileName).toBe('hazard.png')
    expect(body.blobPath).toMatch(
      /^form-uploads\/assignment_1\/worker_1\/photo-/
    )
  })
})
