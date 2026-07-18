import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getAllAssignments } from '../admin/assignments/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetAllAssignmentsForAdmin } = vi.hoisted(() => ({
  mockGetAllAssignmentsForAdmin: vi.fn()
}))
vi.mock('@/lib/assignments', () => ({
  getAllAssignmentsForAdmin: mockGetAllAssignmentsForAdmin
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_ROW = {
  assignmentId: 'assignment_123',
  company: { id: 'company_123', name: 'Acme Farm' },
  template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
  templateVersion: 1,
  assignedTo: 'All staff',
  dueDate: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  completionCount: 0
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAllAssignmentsForAdmin.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/admin/assignments
// ---------------------------------------------------------------------------

describe('GET /api/admin/assignments', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await getAllAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await getAllAssignments()
    expect(res.status).toBe(403)
  })

  it('returns 200 with an empty list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await getAllAssignments()
    expect(res.status).toBe(200)
    expect((await res.json()).assignments).toEqual([])
  })

  it('returns 200 with assignments', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAllAssignmentsForAdmin.mockResolvedValue([BASE_ROW])
    const res = await getAllAssignments()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(1)
    expect(body.assignments[0].company.name).toBe('Acme Farm')
  })

  it('returns 500 when getAllAssignmentsForAdmin throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAllAssignmentsForAdmin.mockRejectedValue(new Error('DB error'))
    const res = await getAllAssignments()
    expect(res.status).toBe(500)
  })
})
