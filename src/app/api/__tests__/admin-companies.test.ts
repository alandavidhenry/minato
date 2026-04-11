import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DELETE as deleteCompany,
  GET as getCompany,
  PATCH as updateCompany
} from '../admin/companies/[id]/route'
import {
  GET as listCompanies,
  POST as createCompany
} from '../admin/companies/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAll, mockCreate, mockGetById, mockUpdate, mockDelete } =
  vi.hoisted(() => ({
    mockGetAll: vi.fn(),
    mockCreate: vi.fn(),
    mockGetById: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn()
  }))

vi.mock('@/lib/customer-companies', () => ({
  getAllCustomerCompanies: mockGetAll,
  createCustomerCompany: mockCreate,
  getCustomerCompanyById: mockGetById,
  updateCustomerCompany: mockUpdate,
  deleteCustomerCompany: mockDelete
}))

const { mockCreateFolder, mockDeleteFolder } = vi.hoisted(() => ({
  mockCreateFolder: vi.fn(),
  mockDeleteFolder: vi.fn()
}))
vi.mock('@/lib/file-system', () => ({
  getFileManager: () => ({
    createFolder: mockCreateFolder,
    deleteFolder: mockDeleteFolder
  })
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_COMPANY = {
  id: 'company_123',
  name: 'Acme Ltd',
  tenantId: null,
  createdAt: '2024-01-01T00:00:00.000Z'
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockResolvedValue([])
  mockCreate.mockResolvedValue(BASE_COMPANY)
  mockGetById.mockResolvedValue(null)
  mockUpdate.mockResolvedValue(true)
  mockDelete.mockResolvedValue(true)
  mockCreateFolder.mockResolvedValue({ success: true, message: '' })
  mockDeleteFolder.mockResolvedValue({ success: true, message: '' })
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listCompanies()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listCompanies()
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listCompanies()
    expect(res.status).toBe(200)
    expect((await res.json()).companies).toEqual([])
  })

  it('returns 200 with companies', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAll.mockResolvedValue([BASE_COMPANY])
    const res = await listCompanies()
    const body = await res.json()
    expect(body.companies).toHaveLength(1)
    expect(body.companies[0].name).toBe('Acme Ltd')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/companies
// ---------------------------------------------------------------------------

describe('POST /api/admin/companies', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/admin/companies', 'POST', {
      name: 'Acme Ltd'
    })
    const res = await createCompany(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/companies', 'POST', {})
    const res = await createCompany(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/i)
  })

  it('returns 200 with new company and correct folderPath', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/companies', 'POST', {
      name: 'Acme Ltd'
    })
    const res = await createCompany(req)
    expect(res.status).toBe(200)
    expect((await res.json()).company.name).toBe('Acme Ltd')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: 'acme-ltd' })
    )
  })

  it('strips apostrophes when generating folderPath', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreate.mockResolvedValue({ ...BASE_COMPANY, name: "Terry's Tractors" })
    const req = jsonRequest('http://localhost/api/admin/companies', 'POST', {
      name: "Terry's Tractors"
    })
    await createCompany(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: 'terrys-tractors' })
    )
  })

  it('strips other punctuation when generating folderPath', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreate.mockResolvedValue({ ...BASE_COMPANY, name: "O'Brien & Sons" })
    const req = jsonRequest('http://localhost/api/admin/companies', 'POST', {
      name: "O'Brien & Sons"
    })
    await createCompany(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: 'obrien-sons' })
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies/[id]
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123'
    )
    const res = await getCompany(req, params('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest('http://localhost/api/admin/companies/missing')
    const res = await getCompany(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with company', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPANY)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123'
    )
    const res = await getCompany(req, params('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).company.name).toBe('Acme Ltd')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/companies/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/companies/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123',
      'PATCH',
      { name: 'Updated' }
    )
    const res = await updateCompany(req, params('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when update fails', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockUpdate.mockResolvedValue(false)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/missing',
      'PATCH',
      { name: 'Updated' }
    )
    const res = await updateCompany(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123',
      'PATCH',
      { name: 'Updated' }
    )
    const res = await updateCompany(req, params('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/companies/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/companies/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompany(req, params('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when company does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/missing',
      { method: 'DELETE' }
    )
    const res = await deleteCompany(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when company has assignments', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPANY)
    mockDelete.mockResolvedValue(false)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompany(req, params('company_123'))
    expect(res.status).toBe(409)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPANY)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompany(req, params('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})
