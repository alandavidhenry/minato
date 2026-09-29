import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH } from '../admin/settings/review-period/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const {
  mockGetAdminTenantId,
  mockGetReviewPeriodMonths,
  mockUpdateReviewPeriodMonths
} = vi.hoisted(() => ({
  mockGetAdminTenantId: vi.fn(),
  mockGetReviewPeriodMonths: vi.fn(),
  mockUpdateReviewPeriodMonths: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getAdminTenantId: mockGetAdminTenantId,
  getReviewPeriodMonths: mockGetReviewPeriodMonths,
  updateReviewPeriodMonths: mockUpdateReviewPeriodMonths
}))

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { id: 'user_1', roles: ['Customer User'] } }

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/settings/review-period', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
  mockGetAdminTenantId.mockResolvedValue('tenant_1')
  mockGetReviewPeriodMonths.mockResolvedValue(12)
  mockUpdateReviewPeriodMonths.mockResolvedValue(true)
})

describe('GET /api/admin/settings/review-period', () => {
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

  it('returns the review period with its bounds', async () => {
    mockGetReviewPeriodMonths.mockResolvedValue(24)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      reviewPeriodMonths: 24,
      min: 1,
      max: 120,
      default: 12
    })
    expect(mockGetReviewPeriodMonths).toHaveBeenCalledWith('tenant_1')
  })
})

describe('PATCH /api/admin/settings/review-period', () => {
  it('returns 401 for non-admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    expect((await PATCH(patchRequest({ reviewPeriodMonths: 14 }))).status).toBe(
      401
    )
  })

  it.each([0, -1, 121, 2.5, 'abc', null])(
    'returns 400 for invalid value %s',
    async (bad) => {
      const res = await PATCH(patchRequest({ reviewPeriodMonths: bad }))
      expect(res.status).toBe(400)
      expect(mockUpdateReviewPeriodMonths).not.toHaveBeenCalled()
    }
  )

  it('returns 404 when no tenant is found', async () => {
    mockGetAdminTenantId.mockResolvedValue(null)
    expect((await PATCH(patchRequest({ reviewPeriodMonths: 14 }))).status).toBe(
      404
    )
  })

  it('returns 500 when saving fails', async () => {
    mockUpdateReviewPeriodMonths.mockResolvedValue(false)
    expect((await PATCH(patchRequest({ reviewPeriodMonths: 14 }))).status).toBe(
      500
    )
  })

  it('saves a valid review period', async () => {
    const res = await PATCH(patchRequest({ reviewPeriodMonths: 14 }))
    expect(res.status).toBe(200)
    expect(mockUpdateReviewPeriodMonths).toHaveBeenCalledWith('tenant_1', 14)
  })
})
