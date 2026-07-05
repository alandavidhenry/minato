import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as listCompanyUsers } from '../admin/companies/[id]/users/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockGetUsersByCompany } = vi.hoisted(() => ({
  mockGetUsersByCompany: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({
  getUsersByCompany: mockGetUsersByCompany
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }

const BASE_USER = {
  id: 'user_123',
  displayName: 'Alice',
  email: 'alice@example.com',
  role: 'Customer User',
  jobRole: 'Site Manager',
  lineManagerId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: 'company_123'
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUsersByCompany.mockResolvedValue([])
})

describe('GET /api/admin/companies/[id]/users', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/users'
    )
    const res = await listCompanyUsers(req, params('company_123'))
    expect(res.status).toBe(403)
  })

  it('returns 200 with an empty user list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/users'
    )
    const res = await listCompanyUsers(req, params('company_123'))
    expect(res.status).toBe(200)
    expect((await res.json()).users).toEqual([])
  })

  it('returns users including jobRole', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetUsersByCompany.mockResolvedValue([BASE_USER])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/users'
    )
    const res = await listCompanyUsers(req, params('company_123'))
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].jobRole).toBe('Site Manager')
  })

  it('returns null jobRole when not set', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetUsersByCompany.mockResolvedValue([{ ...BASE_USER, jobRole: null }])
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/users'
    )
    const res = await listCompanyUsers(req, params('company_123'))
    const body = await res.json()
    expect(body.users[0].jobRole).toBeNull()
  })

  it('returns 500 on error', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockGetUsersByCompany.mockRejectedValue(new Error('db error'))
    const req = new NextRequest(
      'http://localhost/api/admin/companies/company_123/users'
    )
    const res = await listCompanyUsers(req, params('company_123'))
    expect(res.status).toBe(500)
  })
})
