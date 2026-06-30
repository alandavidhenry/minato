import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getActivityLogs } from '../admin/activity/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetActivityLogs } = vi.hoisted(() => ({
  mockGetActivityLogs: vi.fn()
}))
vi.mock('@/lib/activity-logger', () => ({
  getActivityLogs: mockGetActivityLogs
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findMany: vi.fn() }
  }
  return { mockPrisma }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const STAFF_SESSION = { user: { roles: ['Tenant Staff'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_LOG = {
  id: 'log_1',
  userId: 'user_abc',
  userName: 'Alice',
  fileName: 'safety-checklist.pdf',
  activityType: 'download',
  timestamp: '2024-03-15T10:30:00.000Z',
  ipAddress: '127.0.0.1'
}

function makeRequest(query: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams(query)
  const url = `http://localhost/api/admin/activity${params.size > 0 ? `?${params}` : ''}`
  return new NextRequest(url)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null)
    const res = await getActivityLogs(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns 403 for customer user role', async () => {
    mockGetServerSession.mockResolvedValueOnce(NON_ADMIN_SESSION)
    const res = await getActivityLogs(makeRequest())
    expect(res.status).toBe(403)
  })

  it('allows Tenant Staff to view logs', async () => {
    mockGetServerSession.mockResolvedValueOnce(STAFF_SESSION)
    mockGetActivityLogs.mockResolvedValueOnce([BASE_LOG])
    const res = await getActivityLogs(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs).toHaveLength(1)
  })

  it('returns all logs for admin with no filters', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetActivityLogs.mockResolvedValueOnce([BASE_LOG])
    const res = await getActivityLogs(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs).toEqual([BASE_LOG])
    expect(mockGetActivityLogs).toHaveBeenCalledWith({
      userId: undefined,
      userIds: undefined,
      startDate: undefined,
      endDate: undefined
    })
  })

  it('passes userId filter through to getActivityLogs', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetActivityLogs.mockResolvedValueOnce([BASE_LOG])
    const res = await getActivityLogs(makeRequest({ userId: 'user_abc' }))
    expect(res.status).toBe(200)
    expect(mockGetActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_abc' })
    )
  })

  it('resolves companyId to userIds and passes them to getActivityLogs', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'user_1' },
      { id: 'user_2' }
    ])
    mockGetActivityLogs.mockResolvedValueOnce([BASE_LOG])

    const res = await getActivityLogs(makeRequest({ companyId: 'company_x' }))
    expect(res.status).toBe(200)
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { customerCompanyId: 'company_x' },
      select: { id: true }
    })
    expect(mockGetActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['user_1', 'user_2'] })
    )
  })

  it('returns empty array immediately when company has no users', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockPrisma.user.findMany.mockResolvedValueOnce([])

    const res = await getActivityLogs(makeRequest({ companyId: 'empty_co' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs).toEqual([])
    expect(mockGetActivityLogs).not.toHaveBeenCalled()
  })

  it('normalises date params to ISO timestamps', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetActivityLogs.mockResolvedValueOnce([])

    await getActivityLogs(
      makeRequest({ startDate: '2024-01-01', endDate: '2024-01-31' })
    )
    expect(mockGetActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z'
      })
    )
  })

  it('applies limit after fetching logs', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    const manyLogs = Array.from({ length: 10 }, (_, i) => ({
      ...BASE_LOG,
      id: `log_${i}`
    }))
    mockGetActivityLogs.mockResolvedValueOnce(manyLogs)

    const res = await getActivityLogs(makeRequest({ limit: '3' }))
    const body = await res.json()
    expect(body.logs).toHaveLength(3)
  })

  it('returns 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValueOnce(ADMIN_SESSION)
    mockGetActivityLogs.mockRejectedValueOnce(new Error('Storage unavailable'))

    const res = await getActivityLogs(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
