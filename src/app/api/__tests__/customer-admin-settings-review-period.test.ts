import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH } from '../customer/admin/settings/review-period/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetOverride, mockGetEffective, mockUpdate } = vi.hoisted(() => ({
  mockGetOverride: vi.fn(),
  mockGetEffective: vi.fn(),
  mockUpdate: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getCompanyReviewPeriodMonths: mockGetOverride,
  getReviewPeriodMonthsForCompany: mockGetEffective,
  updateCompanyReviewPeriodMonths: mockUpdate
}))

const SESSION = {
  user: { id: 'ca_1', roles: ['Customer Admin'], customerCompanyId: 'co_1' }
}

function patchRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/customer/admin/settings/review-period',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetServerSession.mockResolvedValue(SESSION)
  mockGetOverride.mockResolvedValue(null)
  mockGetEffective.mockResolvedValue(12)
  mockUpdate.mockResolvedValue(true)
})

describe('customer admin review-period settings auth', () => {
  it('returns 403 for non customer admins', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer User'], customerCompanyId: 'co_1' }
    })
    expect((await GET()).status).toBe(403)
    expect((await PATCH(patchRequest({ reviewPeriodMonths: 6 }))).status).toBe(
      403
    )
  })

  it('returns 403 when the admin has no company', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'ca_1', roles: ['Customer Admin'] }
    })
    expect((await GET()).status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('GET /api/customer/admin/settings/review-period', () => {
  it('returns the company override and the effective period', async () => {
    mockGetOverride.mockResolvedValue(6)
    mockGetEffective.mockResolvedValue(6)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reviewPeriodMonths: 6, effective: 6 })
    expect(mockGetOverride).toHaveBeenCalledWith('co_1')
    expect(mockGetEffective).toHaveBeenCalledWith('co_1')
  })

  it('returns a null override when the company inherits', async () => {
    const res = await GET()
    expect(await res.json()).toEqual({
      reviewPeriodMonths: null,
      effective: 12
    })
  })
})

describe('PATCH /api/customer/admin/settings/review-period', () => {
  it.each([0, -1, 121, 2.5, '6', undefined])(
    'returns 400 for invalid value %s',
    async (bad) => {
      const res = await PATCH(patchRequest({ reviewPeriodMonths: bad }))
      expect(res.status).toBe(400)
      expect(mockUpdate).not.toHaveBeenCalled()
    }
  )

  it('saves a valid period for the session company', async () => {
    const res = await PATCH(patchRequest({ reviewPeriodMonths: 18 }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('co_1', 18)
  })

  it('clears the override with null', async () => {
    const res = await PATCH(patchRequest({ reviewPeriodMonths: null }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('co_1', null)
  })

  it('returns 500 when saving fails', async () => {
    mockUpdate.mockResolvedValue(false)
    expect((await PATCH(patchRequest({ reviewPeriodMonths: 6 }))).status).toBe(
      500
    )
  })
})
