import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getOutstandingCompletions } from '../admin/completions/outstanding/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetOutstandingCompletions } = vi.hoisted(() => ({
  mockGetOutstandingCompletions: vi.fn()
}))
vi.mock('@/lib/outstanding-completions', () => ({
  getOutstandingCompletions: mockGetOutstandingCompletions
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const STAFF_SESSION = { user: { roles: ['Tenant Staff'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_ROW = {
  assignmentId: 'assignment_123',
  company: { id: 'company_123', name: 'Acme Farm' },
  template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
  templateVersion: 2,
  assignedTo: 'Jane Smith',
  assignedUserId: 'user_123',
  assignedUserJobRole: 'Driver',
  targetJobRoles: null,
  dueDate: '2026-06-10T00:00:00.000Z',
  daysOverdue: 5,
  isOverdue: true,
  lastReminderSentAt: '2026-06-08T00:00:00.000Z',
  outstandingCount: 1
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetOutstandingCompletions.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/admin/completions/outstanding
// ---------------------------------------------------------------------------

describe('GET /api/admin/completions/outstanding', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin roles', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 403 for Tenant Staff (admin-only feature)', async () => {
    mockGetServerSession.mockResolvedValue(STAFF_SESSION)
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty rows', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(200)
    expect((await res.json()).rows).toEqual([])
  })

  it('returns 200 with outstanding rows for admin', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetOutstandingCompletions.mockResolvedValue([BASE_ROW])
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]).toEqual(BASE_ROW)
  })

  it('returns 500 when getOutstandingCompletions throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetOutstandingCompletions.mockRejectedValue(new Error('DB error'))
    const res = await getOutstandingCompletions()
    expect(res.status).toBe(500)
  })
})
