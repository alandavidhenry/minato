import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getDashboardCompletions } from '../admin/dashboard/completions/route'
import { GET as getDashboardStats } from '../admin/dashboard/stats/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetDashboardKPIs } = vi.hoisted(() => ({
  mockGetDashboardKPIs: vi.fn()
}))
vi.mock('@/lib/dashboard', () => ({
  getDashboardKPIs: mockGetDashboardKPIs
}))

const { mockGetRecentCompletions } = vi.hoisted(() => ({
  mockGetRecentCompletions: vi.fn()
}))
vi.mock('@/lib/completion-records', () => ({
  getRecentCompletionsForAdmin: mockGetRecentCompletions
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_KPIS = {
  activeAssignments: 10,
  completedThisMonth: 3,
  outstanding: 5,
  overdue: 2
}

const BASE_COMPLETION = {
  id: 'record_123',
  signedAt: '2024-01-01T00:00:00.000Z',
  blobPath: 'completions/record_123.pdf',
  signer: {
    id: 'user_123',
    displayName: 'Jane Smith',
    email: 'jane@example.com'
  },
  assignment: {
    id: 'assignment_123',
    template: { id: 'template_123', title: 'Farmyard Safety Checklist' },
    customerCompany: { id: 'company_123', name: 'Acme Farm' }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDashboardKPIs.mockResolvedValue(BASE_KPIS)
  mockGetRecentCompletions.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/admin/dashboard/stats
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard/stats', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await getDashboardStats()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await getDashboardStats()
    expect(res.status).toBe(403)
  })

  it('returns 200 with all four KPI fields for admin', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await getDashboardStats()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activeAssignments).toBe(10)
    expect(body.completedThisMonth).toBe(3)
    expect(body.outstanding).toBe(5)
    expect(body.overdue).toBe(2)
  })

  it('returns 500 when getDashboardKPIs throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetDashboardKPIs.mockRejectedValue(new Error('DB error'))
    const res = await getDashboardStats()
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/dashboard/completions
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard/completions', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    const res = await getDashboardCompletions(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    const res = await getDashboardCompletions(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty completions list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    const res = await getDashboardCompletions(req)
    expect(res.status).toBe(200)
    expect((await res.json()).completions).toHaveLength(0)
  })

  it('returns 200 with recent completions including signer and company', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetRecentCompletions.mockResolvedValue([BASE_COMPLETION])
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    const res = await getDashboardCompletions(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.completions).toHaveLength(1)
    expect(body.completions[0].signer.displayName).toBe('Jane Smith')
    expect(body.completions[0].assignment.template.title).toBe(
      'Farmyard Safety Checklist'
    )
    expect(body.completions[0].assignment.customerCompany.name).toBe(
      'Acme Farm'
    )
  })

  it('passes default limit of 5 to getRecentCompletionsForAdmin', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    await getDashboardCompletions(req)
    expect(mockGetRecentCompletions).toHaveBeenCalledWith(5)
  })

  it('passes custom limit query param to getRecentCompletionsForAdmin', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions?limit=3'
    )
    await getDashboardCompletions(req)
    expect(mockGetRecentCompletions).toHaveBeenCalledWith(3)
  })

  it('caps limit at 20', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions?limit=100'
    )
    await getDashboardCompletions(req)
    expect(mockGetRecentCompletions).toHaveBeenCalledWith(20)
  })

  it('returns 500 when getRecentCompletionsForAdmin throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetRecentCompletions.mockRejectedValue(new Error('DB error'))
    const req = new NextRequest(
      'http://localhost/api/admin/dashboard/completions'
    )
    const res = await getDashboardCompletions(req)
    expect(res.status).toBe(500)
  })
})
