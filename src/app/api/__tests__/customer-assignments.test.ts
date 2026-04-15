import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as completeAssignment } from '../customer/assignments/[id]/complete/route'
import { GET as downloadAssignment } from '../customer/assignments/[id]/download/route'
import { GET as listAssignments } from '../customer/assignments/route'
import { GET as listCompletions } from '../customer/completions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetForCompany, mockGetById } = vi.hoisted(() => ({
  mockGetForCompany: vi.fn(),
  mockGetById: vi.fn()
}))
vi.mock('@/lib/assignments', () => ({
  getAssignmentsForCompany: mockGetForCompany,
  getAssignmentById: mockGetById
}))

const { mockGetTemplateById } = vi.hoisted(() => ({
  mockGetTemplateById: vi.fn()
}))
vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetTemplateById
}))

const { mockGenerateDownloadUrl } = vi.hoisted(() => ({
  mockGenerateDownloadUrl: vi.fn()
}))
vi.mock('@/lib/file-system', () => ({
  getFileManager: () => ({ generateDownloadUrl: mockGenerateDownloadUrl })
}))

const { mockCreateCompletion, mockGetForUser } = vi.hoisted(() => ({
  mockCreateCompletion: vi.fn(),
  mockGetForUser: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  createCompletionRecord: mockCreateCompletion,
  getCompletionsForUser: mockGetForUser
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_SESSION = {
  user: {
    id: 'user_123',
    roles: ['Customer User'],
    customerCompanyId: 'company_123'
  }
}
const NO_COMPANY_SESSION = {
  user: { id: 'user_123', roles: ['Customer User'], customerCompanyId: null }
}
const ADMIN_SESSION = {
  user: { id: 'admin_123', roles: ['Tenant Admin'], customerCompanyId: null }
}

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

const BASE_COMPLETION = {
  id: 'record_123',
  assignmentId: 'assignment_123',
  signedById: 'user_123',
  signedAt: '2024-01-01T00:00:00.000Z',
  blobPath: null,
  formData: null,
  assignment: {
    id: 'assignment_123',
    templateId: 'template_123',
    template: {
      id: 'template_123',
      title: 'Farmyard Safety Checklist',
      description: null
    }
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function jsonRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetForCompany.mockResolvedValue([])
  mockGetById.mockResolvedValue(null)
  mockCreateCompletion.mockResolvedValue(BASE_COMPLETION)
  mockGetForUser.mockResolvedValue([])
  mockGetTemplateById.mockResolvedValue(null)
  mockGenerateDownloadUrl.mockResolvedValue(null)
})

// ---------------------------------------------------------------------------
// GET /api/customer/assignments
// ---------------------------------------------------------------------------

describe('GET /api/customer/assignments', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role (not a customer)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 403 when customer has no company', async () => {
    mockGetServerSession.mockResolvedValue(NO_COMPANY_SESSION)
    const res = await listAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 200 with assignments for the company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetForCompany.mockResolvedValue([BASE_ASSIGNMENT])
    const res = await listAssignments()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(1)
    expect(body.assignments[0].template.title).toBe('Farmyard Safety Checklist')
  })
})

// ---------------------------------------------------------------------------
// POST /api/customer/assignments/[id]/complete
// ---------------------------------------------------------------------------

describe('POST /api/customer/assignments/[id]/complete', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete'
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/missing/complete'
    )
    const res = await completeAssignment(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete'
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with completion record', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    const req = jsonRequest(
      'http://localhost/api/customer/assignments/assignment_123/complete'
    )
    const res = await completeAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completion.assignmentId).toBe('assignment_123')
    expect(body.completion.signedById).toBe('user_123')
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/completions
// ---------------------------------------------------------------------------

describe('GET /api/customer/completions', () => {
  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 200 with completions', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetForUser.mockResolvedValue([BASE_COMPLETION])
    const res = await listCompletions()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].assignment.template.title).toBe(
      'Farmyard Safety Checklist'
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/assignments/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/customer/assignments/[id]/download', () => {
  const BASE_TEMPLATE_WITH_BLOB = {
    id: 'template_123',
    title: 'Farmyard Safety Checklist',
    description: null,
    blobPath: 'templates/farmyard-safety.pdf',
    tenantId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }

  it('returns 403 when not a customer', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment not found', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/missing/download'
    )
    const res = await downloadAssignment(req, params('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue({
      ...BASE_ASSIGNMENT,
      customerCompanyId: 'other_company'
    })
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when template has no file', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockGetTemplateById.mockResolvedValue({
      ...BASE_TEMPLATE_WITH_BLOB,
      blobPath: null
    })
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/no file/i)
  })

  it('returns 200 with a download URL', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockGetById.mockResolvedValue(BASE_ASSIGNMENT)
    mockGetTemplateById.mockResolvedValue(BASE_TEMPLATE_WITH_BLOB)
    mockGenerateDownloadUrl.mockResolvedValue(
      'https://blob.example.com/sas-url'
    )
    const req = new NextRequest(
      'http://localhost/api/customer/assignments/assignment_123/download'
    )
    const res = await downloadAssignment(req, params('assignment_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.example.com/sas-url')
  })
})
