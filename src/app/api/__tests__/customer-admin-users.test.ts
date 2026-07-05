import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as listUsers } from '../customer/admin/users/route'

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

const COMPANY_ADMIN_SESSION = {
  user: {
    id: 'ca_1',
    roles: ['Customer Admin'],
    customerCompanyId: 'company_123'
  }
}
const NON_ADMIN_SESSION = { user: { roles: ['Customer User'] } }

const BASE_USER = {
  id: 'user_123',
  email: 'user@company.com',
  displayName: 'Test User',
  passwordHash: 'hash',
  role: 'Customer User',
  jobRole: 'Site Manager',
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: 'company_123'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUsersByCompany.mockResolvedValue([])
})

describe('GET /api/customer/admin/users', () => {
  it('returns 403 when not a Customer Admin', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const res = await listUsers()
    expect(res.status).toBe(403)
  })

  it('returns 200 with users scoped to the session company', async () => {
    mockGetServerSession.mockResolvedValue(COMPANY_ADMIN_SESSION)
    mockGetUsersByCompany.mockResolvedValue([BASE_USER])
    const res = await listUsers()
    expect(res.status).toBe(200)
    expect(mockGetUsersByCompany).toHaveBeenCalledWith('company_123')
    const body = await res.json()
    expect(body.users).toEqual([
      { id: 'user_123', displayName: 'Test User', jobRole: 'Site Manager' }
    ])
  })
})
