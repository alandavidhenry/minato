import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as getReviewDue } from '../customer/admin/templates/review-due/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetDue } = vi.hoisted(() => ({ mockGetDue: vi.fn() }))
vi.mock('@/lib/template-reviews', () => ({
  getTemplatesDueForReview: mockGetDue
}))

const SESSION = {
  user: { id: 'ca_1', roles: ['Customer Admin'], customerCompanyId: 'co_1' }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/customer/admin/templates/review-due', () => {
  it('returns 403 for non customer admins', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer User'], customerCompanyId: 'co_1' }
    })
    expect((await getReviewDue()).status).toBe(403)
  })

  it('returns 403 when the admin has no company', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'ca_1', roles: ['Customer Admin'] }
    })
    expect((await getReviewDue()).status).toBe(403)
  })

  it('returns the count and templates scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockGetDue.mockResolvedValue([{ id: 't1', status: 'overdue' }])
    const res = await getReviewDue()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      count: 1,
      templates: [{ id: 't1', status: 'overdue' }]
    })
    expect(mockGetDue).toHaveBeenCalledWith(expect.any(Date), 'co_1')
  })

  it('returns 500 when the lookup throws', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockGetDue.mockRejectedValue(new Error('boom'))
    expect((await getReviewDue()).status).toBe(500)
  })
})
