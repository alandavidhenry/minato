import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE as removeAssignment } from '../admin/companies/[id]/assignments/[assignmentId]/route'
import {
  GET as listAssignments,
  POST as createAssignment
} from '../admin/companies/[id]/assignments/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetForCompany,
  mockCreate,
  mockGetByTemplateAndCompany,
  mockGetById,
  mockDelete
} = vi.hoisted(() => ({
  mockGetForCompany: vi.fn(),
  mockCreate: vi.fn(),
  mockGetByTemplateAndCompany: vi.fn(),
  mockGetById: vi.fn(),
  mockDelete: vi.fn()
}))

vi.mock('@/lib/assignments', () => ({
  getAssignmentsForCompany: mockGetForCompany,
  createAssignment: mockCreate,
  getAssignmentByTemplateAndCompany: mockGetByTemplateAndCompany,
  getAssignmentById: mockGetById,
  deleteAssignment: mockDelete
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }

const BASE_ASSIGNMENT = {
  id: 'assignment_123',
  templateId: 'template_123',
  customerCompanyId: 'company_123',
  createdAt: '2024-01-01T00:00:00.000Z',
  template: {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: null,
    blobPath: null
  }
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function companyParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function assignmentParams(id: string, assignmentId: string) {
  return { params: Promise.resolve({ id, assignmentId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetForCompany.mockResolvedValue([])
  mockCreate.mockResolvedValue(BASE_ASSIGNMENT)
  mockGetByTemplateAndCompany.mockResolvedValue(null)
  mockGetById.mockResolvedValue(null)
  mockDelete.mockResolvedValue(true)
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies/[id]/assignments
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies/[id]/assignments', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments'
    )
    const res = await listAssignments(req, companyParams('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with assignments', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetForCompany.mockResolvedValue([BASE_ASSIGNMENT])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments'
    )
    const res = await listAssignments(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(1)
    expect(body.assignments[0].template.title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/companies/[id]/assignments
// ---------------------------------------------------------------------------

describe('POST /api/admin/companies/[id]/assignments', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when templateId is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      {}
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/templateId/i)
  })

  it('returns 409 when already assigned', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetByTemplateAndCompany.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already assigned/i)
  })

  it('returns 200 with new assignment', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/companies/company_123/assignments',
      'POST',
      { templateId: 'template_123' }
    )
    const res = await createAssignment(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).assignment.templateId).toBe('template_123')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/companies/[id]/assignments/[assignmentId]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/companies/[id]/assignments/[assignmentId]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/missing',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'missing')
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when assignment has existing completions', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockDelete.mockResolvedValue(false)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/completion/)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123',
      { method: 'DELETE' }
    )
    const res = await removeAssignment(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})
