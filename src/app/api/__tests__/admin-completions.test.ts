import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as listAssignmentCompletions } from '../admin/companies/[id]/assignments/[assignmentId]/completions/route'
import { GET as listCompanyCompletions } from '../admin/companies/[id]/completions/route'
import { GET as downloadCompletion } from '../admin/completions/[id]/download/route'
import { DELETE as deleteCompletion } from '../admin/completions/[id]/route'
import { GET as listCompanies } from '../admin/completions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetCompanies,
  mockGetGroups,
  mockGetAssignmentStatusSummary,
  mockGetById,
  mockDelete
} = vi.hoisted(() => ({
  mockGetCompanies: vi.fn(),
  mockGetGroups: vi.fn(),
  mockGetAssignmentStatusSummary: vi.fn(),
  mockGetById: vi.fn(),
  mockDelete: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  getCompaniesWithCompletions: mockGetCompanies,
  getCompletionGroupsByCompany: mockGetGroups,
  getAssignmentStatusSummary: mockGetAssignmentStatusSummary,
  getCompletionById: mockGetById,
  deleteCompletionRecord: mockDelete
}))

const { mockGenerateSasToken, mockDeleteBlob } = vi.hoisted(() => ({
  mockGenerateSasToken: vi.fn(),
  mockDeleteBlob: vi.fn()
}))
vi.mock('@/lib/storage', () => ({
  generateSasToken: mockGenerateSasToken,
  deleteBlob: mockDeleteBlob
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_COMPANY = {
  id: 'company_123',
  name: 'Acme Farm',
  completionCount: 3
}

const BASE_GROUP = {
  assignmentId: 'assignment_123',
  template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
  completionCount: 2,
  lastCompletedAt: '2024-01-01T00:00:00.000Z',
  dueDate: null,
  isOverdue: false,
  outstandingCount: 0
}

const BASE_STATUS_SUMMARY = {
  templateTitle: 'Farmyard Safety Checklist',
  dueDate: null,
  isOverdue: false,
  completedRecords: [
    {
      id: 'record_123',
      signedAt: '2024-01-01T00:00:00.000Z',
      blobPath: 'completions/record_123.pdf',
      signer: {
        id: 'user_123',
        displayName: 'Jane Smith',
        email: 'jane@example.com'
      }
    }
  ],
  outstandingUsers: []
}

const BASE_COMPLETION = {
  id: 'record_123',
  signedAt: '2024-01-01T00:00:00.000Z',
  blobPath: 'completions/record_123.pdf',
  signer: {
    id: 'user_123',
    displayName: 'Jane Smith',
    email: 'jane@example.com'
  }
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function companyParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function assignmentParams(id: string, assignmentId: string) {
  return { params: Promise.resolve({ id, assignmentId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCompanies.mockResolvedValue([])
  mockGetGroups.mockResolvedValue([])
  mockGetAssignmentStatusSummary.mockResolvedValue(null)
  mockGetById.mockResolvedValue(null)
  mockDelete.mockResolvedValue(true)
  mockGenerateSasToken.mockResolvedValue('https://blob.example.com/sas-url')
  mockDeleteBlob.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions', () => {
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

  it('returns 200 with empty companies list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await listCompanies()
    expect(res.status).toBe(200)
    expect((await res.json()).companies).toHaveLength(0)
  })

  it('returns 200 with companies and completion counts', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetCompanies.mockResolvedValue([BASE_COMPANY])
    const res = await listCompanies()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.companies).toHaveLength(1)
    expect(body.companies[0].name).toBe('Acme Farm')
    expect(body.companies[0].completionCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies/[id]/completions
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies/[id]/completions', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/completions'
    )
    const res = await listCompanyCompletions(req, companyParams('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with completion groups', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetGroups.mockResolvedValue([BASE_GROUP])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/completions'
    )
    const res = await listCompanyCompletions(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0].template.title).toBe('Farmyard Safety Checklist')
    expect(body.groups[0].completionCount).toBe(2)
  })

  it('returns 200 with empty groups when no completions', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/completions'
    )
    const res = await listCompanyCompletions(req, companyParams('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).groups).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/companies/[id]/assignments/[assignmentId]/completions
// ---------------------------------------------------------------------------

describe('GET /api/admin/companies/[id]/assignments/[assignmentId]/completions', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123/completions'
    )
    const res = await listAssignmentCompletions(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAssignmentStatusSummary.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/missing/completions'
    )
    const res = await listAssignmentCompletions(
      req,
      assignmentParams('company_123', 'missing')
    )
    expect(res.status).toBe(404)
  })

  it('returns 200 with completions and outstanding users', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAssignmentStatusSummary.mockResolvedValue(BASE_STATUS_SUMMARY)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123/completions'
    )
    const res = await listAssignmentCompletions(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].signer.displayName).toBe('Jane Smith')
    expect(body.outstandingUsers).toHaveLength(0)
    expect(body.templateTitle).toBe('Farmyard Safety Checklist')
    expect(body.dueDate).toBeNull()
    expect(body.isOverdue).toBe(false)
    expect(mockGetAssignmentStatusSummary).toHaveBeenCalledWith(
      'assignment_123'
    )
  })

  it('returns isOverdue true and outstanding users when overdue', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAssignmentStatusSummary.mockResolvedValue({
      ...BASE_STATUS_SUMMARY,
      dueDate: '2024-01-01T00:00:00.000Z',
      isOverdue: true,
      completedRecords: [],
      outstandingUsers: [
        { id: 'user_456', displayName: 'Bob Jones', email: 'bob@example.com' }
      ]
    })
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/assignments/assignment_123/completions'
    )
    const res = await listAssignmentCompletions(
      req,
      assignmentParams('company_123', 'assignment_123')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isOverdue).toBe(true)
    expect(body.outstandingUsers).toHaveLength(1)
    expect(body.outstandingUsers[0].displayName).toBe('Bob Jones')
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions/[id]/download
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions/[id]/download', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, idParams('record_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when completion not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/missing/download'
    )
    const res = await downloadCompletion(req, idParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion has no PDF', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue({ ...BASE_COMPLETION, blobPath: null })
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, idParams('record_123'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/pdf not available/i)
  })

  it('returns 200 with download URL', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPLETION)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123/download'
    )
    const res = await downloadCompletion(req, idParams('record_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toBe('https://blob.example.com/sas-url')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/completions/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/completions/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompletion(req, idParams('record_123'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when completion not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/missing',
      { method: 'DELETE' }
    )
    const res = await deleteCompletion(req, idParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 200 and deletes blob when completion has a PDF', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue(BASE_COMPLETION)
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompletion(req, idParams('record_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith('record_123')
    expect(mockDeleteBlob).toHaveBeenCalledTimes(1)
    expect(mockDeleteBlob.mock.calls[0][1]).toBe('completions/record_123.pdf')
  })

  it('returns 200 and skips blob deletion when completion has no PDF', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetById.mockResolvedValue({ ...BASE_COMPLETION, blobPath: null })
    const req = new NextRequest(
      'http://localhost/api/admin/completions/record_123',
      { method: 'DELETE' }
    )
    const res = await deleteCompletion(req, idParams('record_123'))
    expect(res.status).toBe(200)
    expect(mockDeleteBlob).not.toHaveBeenCalled()
  })
})
