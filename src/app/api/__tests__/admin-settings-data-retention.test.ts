import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH } from '../admin/settings/data-retention/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetAdminTenantId,
  mockGetCompletionRetentionYears,
  mockUpdateCompletionRetentionYears
} = vi.hoisted(() => ({
  mockGetAdminTenantId: vi.fn(),
  mockGetCompletionRetentionYears: vi.fn(),
  mockUpdateCompletionRetentionYears: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getAdminTenantId: mockGetAdminTenantId,
  getCompletionRetentionYears: mockGetCompletionRetentionYears,
  updateCompletionRetentionYears: mockUpdateCompletionRetentionYears
}))

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { id: 'user_1', roles: ['Customer User'] } }

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/settings/data-retention', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAdminTenantId.mockResolvedValue('tenant_1')
  mockGetCompletionRetentionYears.mockResolvedValue(5)
  mockUpdateCompletionRetentionYears.mockResolvedValue(true)
})

describe('GET /api/admin/settings/data-retention', () => {
  it('returns 401 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 404 when no tenant found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAdminTenantId.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it('returns the retention policy', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetCompletionRetentionYears.mockResolvedValue(7)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.retentionYears).toBe(7)
    expect(data.default).toBe(5)
  })
})

describe('PATCH /api/admin/settings/data-retention', () => {
  it('returns 401 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await PATCH(patchRequest({ retentionYears: 7 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a non-integer value', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await PATCH(patchRequest({ retentionYears: 2.5 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an out-of-range value', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await PATCH(patchRequest({ retentionYears: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when no tenant found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetAdminTenantId.mockResolvedValue(null)
    const res = await PATCH(patchRequest({ retentionYears: 7 }))
    expect(res.status).toBe(404)
  })

  it('returns 500 when the update fails', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockUpdateCompletionRetentionYears.mockResolvedValue(false)
    const res = await PATCH(patchRequest({ retentionYears: 7 }))
    expect(res.status).toBe(500)
  })

  it('saves and returns success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await PATCH(patchRequest({ retentionYears: 7 }))
    expect(res.status).toBe(200)
    expect(mockUpdateCompletionRetentionYears).toHaveBeenCalledWith(
      'tenant_1',
      7
    )
  })
})
