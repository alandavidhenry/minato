import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, PATCH } from '../profile/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockPrisma, mockBcrypt } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    tenant: {
      findUnique: vi.fn()
    },
    customerCompany: {
      findUnique: vi.fn()
    },
    passwordReset: {
      deleteMany: vi.fn()
    }
  }
  const mockBcrypt = { hash: vi.fn(), compare: vi.fn() }
  return { mockPrisma, mockBcrypt }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

const { mockEnrollUser } = vi.hoisted(() => ({
  mockEnrollUser: vi.fn()
}))
vi.mock('@/lib/assignments', () => ({
  enrollUserInMatchingAssignments: mockEnrollUser
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_SESSION = {
  user: { id: 'user_1', roles: ['Customer User'] }
}
const ADMIN_SESSION = {
  user: { id: 'admin_1', roles: ['Tenant Admin'] }
}

const BASE_USER = {
  id: 'user_1',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer User',
  jobRole: 'Site Manager',
  lineManagerId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  tenantId: 'tenant_1',
  customerCompanyId: 'company_1'
}

const BASE_TENANT = {
  id: 'tenant_1',
  name: 'Default',
  createdAt: new Date(),
  profilePermissions: null
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockBcrypt.hash.mockResolvedValue('$newhashed')
  mockBcrypt.compare.mockResolvedValue(false)
  mockEnrollUser.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------

describe('GET /api/profile', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns profile with default permissions for customer user', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(BASE_USER) // getUserById
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } }) // getProfilePermissions
    mockPrisma.customerCompany.findUnique.mockResolvedValue({
      name: 'Acme Corp'
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user.displayName).toBe('Alice')
    expect(data.user.companyName).toBe('Acme Corp')
    expect(data.user.hasPassword).toBe(true)
    expect(data.user.passwordHash).toBeUndefined()
    expect(data.permissions).toEqual({
      canEditDisplayName: true,
      canEditEmail: true,
      canEditJobRole: true
    })
  })

  it('returns full permissions for admin user (bypasses tenant settings)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      id: 'admin_1',
      role: 'Tenant Admin',
      customerCompanyId: null
    })
    mockPrisma.customerCompany.findUnique.mockResolvedValue(null)

    const res = await GET()
    const data = await res.json()
    expect(data.permissions.canEditDisplayName).toBe(true)
    expect(data.permissions.canEditEmail).toBe(true)
    expect(data.permissions.canEditJobRole).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/profile
// ---------------------------------------------------------------------------

describe('PATCH /api/profile', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(jsonRequest('/api/profile', 'PATCH', {}))
    expect(res.status).toBe(401)
  })

  it('updates display name when permitted', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } }) // permissions
      .mockResolvedValueOnce(BASE_USER) // updateUserProfile lookup
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { displayName: 'Alice Updated' })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('returns 400 for empty display name', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: { ...BASE_TENANT }
    })

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { displayName: '   ' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: { ...BASE_TENANT }
    })

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { email: 'not-an-email' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 when email is already taken', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } }) // permissions
      .mockResolvedValueOnce(BASE_USER) // updateUserProfile initial lookup
      .mockResolvedValueOnce({ ...BASE_USER, id: 'other' }) // email conflict
    mockPrisma.customerCompany.findUnique.mockResolvedValue(null)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { email: 'taken@example.com' })
    )
    expect(res.status).toBe(409)
  })

  it('returns 400 when current password is wrong', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } }) // permissions
      .mockResolvedValueOnce(BASE_USER) // updateUserProfile lookup
    mockBcrypt.compare.mockResolvedValue(false)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', {
        currentPassword: 'wrong',
        newPassword: 'newpass123'
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when new password is too short', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: { ...BASE_TENANT }
    })

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', {
        currentPassword: 'secret',
        newPassword: 'abc'
      })
    )
    expect(res.status).toBe(400)
  })

  it('does not update a field if permission is denied', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    // Tenant has disabled email editing
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: {
        ...BASE_TENANT,
        profilePermissions: {
          canEditDisplayName: true,
          canEditEmail: false,
          canEditJobRole: true
        }
      }
    })
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { email: 'new@example.com' })
    )
    // email field is silently ignored (no update call with email)
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('enrolls the user in matching auto-enroll assignments when jobRole changes', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } }) // permissions
      .mockResolvedValueOnce(BASE_USER) // updateUserProfile lookup
      .mockResolvedValueOnce({
        ...BASE_USER,
        jobRole: 'Supervisor',
        customerCompanyId: 'company_1'
      }) // post-update getUserById
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { jobRole: 'Supervisor' })
    )
    expect(res.status).toBe(200)
    expect(mockEnrollUser).toHaveBeenCalledWith(
      'user_1',
      'company_1',
      'Supervisor'
    )
  })

  it('does not attempt enrollment when the user has no company', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } })
      .mockResolvedValueOnce(BASE_USER)
      .mockResolvedValueOnce({
        ...BASE_USER,
        jobRole: 'Supervisor',
        customerCompanyId: null
      })
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { jobRole: 'Supervisor' })
    )
    expect(res.status).toBe(200)
    expect(mockEnrollUser).not.toHaveBeenCalled()
  })

  it('does not attempt enrollment when jobRole is not part of the update', async () => {
    mockGetServerSession.mockResolvedValue(CUSTOMER_SESSION)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...BASE_USER, tenant: { ...BASE_TENANT } })
      .mockResolvedValueOnce(BASE_USER)
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const res = await PATCH(
      jsonRequest('/api/profile', 'PATCH', { displayName: 'Alice Updated' })
    )
    expect(res.status).toBe(200)
    expect(mockEnrollUser).not.toHaveBeenCalled()
  })
})
