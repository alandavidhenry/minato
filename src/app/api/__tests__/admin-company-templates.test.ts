import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as listCompanyTemplates } from '../admin/companies/[id]/templates/route'

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetByOwnerCompany } = vi.hoisted(() => ({
  mockGetByOwnerCompany: vi.fn()
}))

vi.mock('@/lib/document-templates', () => ({
  getDocumentTemplatesByOwnerCompany: mockGetByOwnerCompany
}))

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer Admin'] } }

const BASE_TEMPLATE = {
  id: 'template_123',
  title: 'Site Induction Checklist',
  description: null,
  version: 1,
  ownerCompanyId: 'company_123',
  createdAt: '2024-01-01T00:00:00.000Z'
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetByOwnerCompany.mockResolvedValue([])
})

describe('GET /api/admin/companies/[id]/templates', () => {
  it('returns 403 for non-admin roles', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/templates'
    )
    const res = await listCompanyTemplates(req, params('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with the company-owned templates', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetByOwnerCompany.mockResolvedValue([BASE_TEMPLATE])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/templates'
    )
    const res = await listCompanyTemplates(req, params('company_123'))
    expect(res.status).toBe(200)
    expect(mockGetByOwnerCompany).toHaveBeenCalledWith('company_123')
    expect((await res.json()).templates).toHaveLength(1)
  })
})
