import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../admin/dashboard/compliance-kpis/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetComplianceKPIs } = vi.hoisted(() => ({
  mockGetComplianceKPIs: vi.fn()
}))
vi.mock('@/lib/compliance-kpis', () => ({
  getComplianceKPIs: mockGetComplianceKPIs
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_KPIS = {
  companyCompletionRates: [],
  monthlyThroughput: [],
  templateAvgDays: [],
  companiesWithNoRecentCompletions: [],
  coverageGaps: [],
  topOverdueUsers: []
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard/compliance-kpis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin roles', async () => {
    mockGetServerSession.mockResolvedValueOnce(NON_ADMIN_SESSION)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 200 with compliance KPIs for admin', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetComplianceKPIs.mockResolvedValueOnce(BASE_KPIS)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(BASE_KPIS)
  })

  it('returns 500 when getComplianceKPIs throws', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetComplianceKPIs.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
