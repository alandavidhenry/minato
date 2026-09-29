import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as reviewTemplate } from '../admin/templates/[id]/review/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockMarkReviewed } = vi.hoisted(() => ({
  mockMarkReviewed: vi.fn()
}))
vi.mock('@/lib/template-reviews', () => ({
  markTemplateReviewed: mockMarkReviewed
}))

const ADMIN_SESSION = { user: { id: 'admin_1', roles: ['Tenant Admin'] } }

function postRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/templates/t1/review', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}
const params = { params: Promise.resolve({ id: 't1' }) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/admin/templates/[id]/review', () => {
  it('returns 403 for non-admins', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer User'] }
    })
    const res = await reviewTemplate(postRequest(), params)
    expect(res.status).toBe(403)
    expect(mockMarkReviewed).not.toHaveBeenCalled()
  })

  it('returns 404 when the template does not exist', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockMarkReviewed.mockResolvedValue(null)
    const res = await reviewTemplate(postRequest(), params)
    expect(res.status).toBe(404)
  })

  it('records the review by the session user, with an optional note', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockMarkReviewed.mockResolvedValue({ template: { id: 't1' }, review: {} })
    const res = await reviewTemplate(
      postRequest({ note: '  all good ' }),
      params
    )
    expect(res.status).toBe(200)
    expect(mockMarkReviewed).toHaveBeenCalledWith('t1', {
      reviewedBy: 'admin_1',
      note: 'all good'
    })
  })

  it('accepts an empty body', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockMarkReviewed.mockResolvedValue({ template: { id: 't1' }, review: {} })
    const res = await reviewTemplate(postRequest(), params)
    expect(res.status).toBe(200)
    expect(mockMarkReviewed).toHaveBeenCalledWith('t1', {
      reviewedBy: 'admin_1',
      note: undefined
    })
  })

  it('returns 500 when the lookup throws', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockMarkReviewed.mockRejectedValue(new Error('boom'))
    const res = await reviewTemplate(postRequest(), params)
    expect(res.status).toBe(500)
  })
})
