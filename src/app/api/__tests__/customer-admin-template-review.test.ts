import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as reviewTemplate } from '../customer/admin/templates/[id]/review/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetById } = vi.hoisted(() => ({ mockGetById: vi.fn() }))
vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplateById: mockGetById
}))

const { mockMarkReviewed } = vi.hoisted(() => ({ mockMarkReviewed: vi.fn() }))
vi.mock('@/lib/template-reviews', () => ({
  markTemplateReviewed: mockMarkReviewed
}))

const SESSION = {
  user: {
    id: 'ca_1',
    roles: ['Customer Admin'],
    customerCompanyId: 'co_1'
  }
}

function postRequest(body?: unknown): NextRequest {
  return new NextRequest(
    'http://localhost/api/customer/admin/templates/t1/review',
    {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    }
  )
}
const params = { params: Promise.resolve({ id: 't1' }) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/customer/admin/templates/[id]/review', () => {
  it('returns 403 for non customer admins', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u', roles: ['Customer User'], customerCompanyId: 'co_1' }
    })
    expect((await reviewTemplate(postRequest(), params)).status).toBe(403)
  })

  it('returns 403 when the admin has no company', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'ca_1', roles: ['Customer Admin'] }
    })
    expect((await reviewTemplate(postRequest(), params)).status).toBe(403)
  })

  it('returns 404 for a template owned by another company or the tenant', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockGetById.mockResolvedValue({ id: 't1', ownerCompanyId: 'co_2' })
    expect((await reviewTemplate(postRequest(), params)).status).toBe(404)
    mockGetById.mockResolvedValue({ id: 't1', ownerCompanyId: null })
    expect((await reviewTemplate(postRequest(), params)).status).toBe(404)
    expect(mockMarkReviewed).not.toHaveBeenCalled()
  })

  it('records the review for an owned template', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockGetById.mockResolvedValue({ id: 't1', ownerCompanyId: 'co_1' })
    mockMarkReviewed.mockResolvedValue({ template: { id: 't1' }, review: {} })
    const res = await reviewTemplate(postRequest({ note: 'fine' }), params)
    expect(res.status).toBe(200)
    expect(mockMarkReviewed).toHaveBeenCalledWith('t1', {
      reviewedBy: 'ca_1',
      note: 'fine'
    })
  })

  it('returns 500 when recording throws', async () => {
    mockGetServerSession.mockResolvedValue(SESSION)
    mockGetById.mockResolvedValue({ id: 't1', ownerCompanyId: 'co_1' })
    mockMarkReviewed.mockRejectedValue(new Error('boom'))
    expect((await reviewTemplate(postRequest(), params)).status).toBe(500)
  })
})
