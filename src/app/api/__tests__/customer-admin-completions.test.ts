import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as downloadPdf } from '../customer/admin/completions/[assignmentId]/download/[completionId]/route'
import { GET as getStatus } from '../customer/admin/completions/[assignmentId]/route'
import { GET as listGroups } from '../customer/admin/completions/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetCompletionGroupsByCompany, mockGetAssignmentStatusSummary } =
  vi.hoisted(() => ({
    mockGetCompletionGroupsByCompany: vi.fn(),
    mockGetAssignmentStatusSummary: vi.fn()
  }))
vi.mock('@/lib/completion-records', () => ({
  getCompletionGroupsByCompany: mockGetCompletionGroupsByCompany,
  getAssignmentStatusSummary: mockGetAssignmentStatusSummary
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    assignment: { findUnique: vi.fn() },
    completionRecord: { findUnique: vi.fn() }
  }
  return { mockPrisma }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

const { mockGenerateSasToken } = vi.hoisted(() => ({
  mockGenerateSasToken: vi.fn()
}))
vi.mock('@/lib/storage', () => ({ generateSasToken: mockGenerateSasToken }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url = 'http://localhost/api/customer/admin/completions') {
  return new NextRequest(url)
}

function adminSession(companyId = 'co_1') {
  return {
    user: {
      id: 'user_1',
      roles: ['Customer Admin'],
      customerCompanyId: companyId
    }
  }
}

function userSession(companyId = 'co_1') {
  return {
    user: {
      id: 'user_1',
      roles: ['Customer User'],
      customerCompanyId: companyId
    }
  }
}

function assignmentParams(assignmentId = 'asgn_1') {
  return { params: Promise.resolve({ assignmentId }) }
}

function downloadParams(assignmentId = 'asgn_1', completionId = 'comp_1') {
  return { params: Promise.resolve({ assignmentId, completionId }) }
}

// ---------------------------------------------------------------------------
// GET /api/customer/admin/completions
// ---------------------------------------------------------------------------

describe('GET /api/customer/admin/completions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await listGroups(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 403 for Customer User role', async () => {
    mockGetServerSession.mockResolvedValue(userSession())
    const res = await listGroups(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 403 when Customer Admin has no company', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer Admin'], customerCompanyId: null }
    })
    const res = await listGroups(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 200 with groups scoped to session company', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    const groups = [
      {
        assignmentId: 'asgn_1',
        template: { id: 't_1', title: 'Fire Safety' },
        templateVersion: 1,
        completionCount: 2,
        lastCompletedAt: null,
        dueDate: null,
        isOverdue: false,
        outstandingCount: 1
      }
    ]
    mockGetCompletionGroupsByCompany.mockResolvedValue(groups)

    const res = await listGroups(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.groups).toEqual(groups)
    expect(mockGetCompletionGroupsByCompany).toHaveBeenCalledWith('co_1')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue(adminSession())
    mockGetCompletionGroupsByCompany.mockRejectedValue(new Error('DB failure'))
    const res = await listGroups(makeRequest())
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/admin/completions/[assignmentId]
// ---------------------------------------------------------------------------

describe('GET /api/customer/admin/completions/[assignmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for Customer User', async () => {
    mockGetServerSession.mockResolvedValue(userSession())
    const res = await getStatus(makeRequest(), assignmentParams())
    expect(res.status).toBe(403)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.assignment.findUnique.mockResolvedValue({
      customerCompanyId: 'co_OTHER'
    })
    const res = await getStatus(makeRequest(), assignmentParams('asgn_1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment does not exist in prisma', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.assignment.findUnique.mockResolvedValue(null)
    const res = await getStatus(makeRequest(), assignmentParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when getAssignmentStatusSummary returns null', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.assignment.findUnique.mockResolvedValue({
      customerCompanyId: 'co_1'
    })
    mockGetAssignmentStatusSummary.mockResolvedValue(null)
    const res = await getStatus(makeRequest(), assignmentParams())
    expect(res.status).toBe(404)
  })

  it('returns 200 with summary — blobPath replaced by hasPdf', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.assignment.findUnique.mockResolvedValue({
      customerCompanyId: 'co_1'
    })
    mockGetAssignmentStatusSummary.mockResolvedValue({
      templateTitle: 'Fire Safety',
      dueDate: null,
      isOverdue: false,
      completedRecords: [
        {
          id: 'comp_1',
          signedAt: '2024-06-01T00:00:00.000Z',
          blobPath: 'some/internal/path.pdf',
          signer: { id: 'u1', displayName: 'Alice', email: 'alice@example.com' }
        },
        {
          id: 'comp_2',
          signedAt: '2024-06-02T00:00:00.000Z',
          blobPath: null,
          signer: { id: 'u2', displayName: 'Bob', email: 'bob@example.com' }
        }
      ],
      outstandingUsers: [{ id: 'u3', displayName: 'Carol', email: null }]
    })

    const res = await getStatus(makeRequest(), assignmentParams('asgn_1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.summary.templateTitle).toBe('Fire Safety')
    // blobPath must not be exposed
    expect(body.summary.completedRecords[0]).not.toHaveProperty('blobPath')
    expect(body.summary.completedRecords[0].hasPdf).toBe(true)
    expect(body.summary.completedRecords[1].hasPdf).toBe(false)
    expect(body.summary.outstandingUsers[0].displayName).toBe('Carol')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.assignment.findUnique.mockRejectedValue(new Error('DB down'))
    const res = await getStatus(makeRequest(), assignmentParams())
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// GET /api/customer/admin/completions/[assignmentId]/download/[completionId]
// ---------------------------------------------------------------------------

describe('GET .../download/[completionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 for Customer User', async () => {
    mockGetServerSession.mockResolvedValue(userSession())
    const res = await downloadPdf(makeRequest(), downloadParams())
    expect(res.status).toBe(403)
  })

  it('returns 403 when Customer Admin has no company', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer Admin'], customerCompanyId: null }
    })
    const res = await downloadPdf(makeRequest(), downloadParams())
    expect(res.status).toBe(403)
  })

  it('returns 404 when completion does not exist', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockResolvedValue(null)
    const res = await downloadPdf(makeRequest(), downloadParams())
    expect(res.status).toBe(404)
  })

  it('returns 404 when completion belongs to a different assignment', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockResolvedValue({
      blobPath: 'path.pdf',
      assignment: { id: 'asgn_OTHER', customerCompanyId: 'co_1' }
    })
    const res = await downloadPdf(
      makeRequest(),
      downloadParams('asgn_1', 'comp_1')
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when assignment belongs to a different company', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockResolvedValue({
      blobPath: 'path.pdf',
      assignment: { id: 'asgn_1', customerCompanyId: 'co_OTHER' }
    })
    const res = await downloadPdf(
      makeRequest(),
      downloadParams('asgn_1', 'comp_1')
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when blobPath is null', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockResolvedValue({
      blobPath: null,
      assignment: { id: 'asgn_1', customerCompanyId: 'co_1' }
    })
    const res = await downloadPdf(
      makeRequest(),
      downloadParams('asgn_1', 'comp_1')
    )
    expect(res.status).toBe(404)
  })

  it('returns 200 with SAS URL when all checks pass', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockResolvedValue({
      blobPath: 'completions/comp_1.pdf',
      assignment: { id: 'asgn_1', customerCompanyId: 'co_1' }
    })
    mockGenerateSasToken.mockResolvedValue('https://storage.example/sas-url')

    const res = await downloadPdf(
      makeRequest(),
      downloadParams('asgn_1', 'comp_1')
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toBe('https://storage.example/sas-url')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue(adminSession('co_1'))
    mockPrisma.completionRecord.findUnique.mockRejectedValue(
      new Error('DB down')
    )
    const res = await downloadPdf(makeRequest(), downloadParams())
    expect(res.status).toBe(500)
  })
})
