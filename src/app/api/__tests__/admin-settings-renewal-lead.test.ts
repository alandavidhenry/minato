import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH } from '../admin/settings/renewal-lead/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetAdminTenantId,
  mockGetRenewalLeadDays,
  mockUpdateRenewalLeadDays
} = vi.hoisted(() => ({
  mockGetAdminTenantId: vi.fn(),
  mockGetRenewalLeadDays: vi.fn(),
  mockUpdateRenewalLeadDays: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getAdminTenantId: mockGetAdminTenantId,
  getRenewalLeadDays: mockGetRenewalLeadDays,
  updateRenewalLeadDays: mockUpdateRenewalLeadDays
}))

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { id: 'user_1', roles: ['Customer User'] } }

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/settings/renewal-lead', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
  mockGetAdminTenantId.mockResolvedValue('tenant_1')
  mockGetRenewalLeadDays.mockResolvedValue(30)
  mockUpdateRenewalLeadDays.mockResolvedValue(true)
})

describe('GET /api/admin/settings/renewal-lead', () => {
  it('returns 401 when not logged in or not an admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    expect((await GET()).status).toBe(401)
  })

  it('returns 404 when no tenant is found', async () => {
    mockGetAdminTenantId.mockResolvedValue(null)
    expect((await GET()).status).toBe(404)
  })

  it('returns the lead time with its bounds', async () => {
    mockGetRenewalLeadDays.mockResolvedValue(45)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      renewalLeadDays: 45,
      min: 1,
      max: 180,
      default: 30
    })
    expect(mockGetRenewalLeadDays).toHaveBeenCalledWith('tenant_1')
  })
})

describe('PATCH /api/admin/settings/renewal-lead', () => {
  it('returns 401 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    expect((await PATCH(patchRequest({ renewalLeadDays: 14 }))).status).toBe(
      401
    )
  })

  it.each([0, -1, 181, 2.5, 'abc', null])(
    'returns 400 for invalid value %s',
    async (bad) => {
      const res = await PATCH(patchRequest({ renewalLeadDays: bad }))
      expect(res.status).toBe(400)
      expect(mockUpdateRenewalLeadDays).not.toHaveBeenCalled()
    }
  )

  it('returns 404 when no tenant is found', async () => {
    mockGetAdminTenantId.mockResolvedValue(null)
    expect((await PATCH(patchRequest({ renewalLeadDays: 14 }))).status).toBe(
      404
    )
  })

  it('returns 500 when saving fails', async () => {
    mockUpdateRenewalLeadDays.mockResolvedValue(false)
    expect((await PATCH(patchRequest({ renewalLeadDays: 14 }))).status).toBe(
      500
    )
  })

  it('saves a valid lead time', async () => {
    const res = await PATCH(patchRequest({ renewalLeadDays: 14 }))
    expect(res.status).toBe(200)
    expect(mockUpdateRenewalLeadDays).toHaveBeenCalledWith('tenant_1', 14)
  })
})
