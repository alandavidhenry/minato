import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as adminResetPassword } from '../admin/users/[id]/reset-password/route'
import {
  POST as assignRole,
  DELETE as removeRole
} from '../admin/users/[id]/role/route'
import {
  GET as getUser,
  PATCH as updateUser,
  DELETE as deleteUser
} from '../admin/users/[id]/route'
import { POST as createUser } from '../admin/users/create/route'
import { GET as listUsers } from '../admin/users/route'

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
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
  const mockBcrypt = { hash: vi.fn(), compare: vi.fn() }
  return { mockPrisma, mockBcrypt }
})
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Administrator'] } }
const NON_ADMIN_SESSION = { user: { roles: ['Customer'] } }

const BASE_USER = {
  id: 'cuid_abc123',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  tenantId: null
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.user.findMany.mockResolvedValue([])
  mockPrisma.user.findUnique.mockResolvedValue(null)
  mockPrisma.user.create.mockResolvedValue(BASE_USER)
  mockPrisma.user.update.mockResolvedValue(BASE_USER)
  mockPrisma.user.delete.mockResolvedValue(BASE_USER)
  mockBcrypt.hash.mockResolvedValue('$newhashed')
  mockBcrypt.compare.mockResolvedValue(false)
})

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

describe('GET /api/admin/users', () => {
  it('returns 403 when not logged in', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await listUsers(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-admin users', async () => {
    mockGetServerSession.mockResolvedValue(NON_ADMIN_SESSION)
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await listUsers(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty user list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await listUsers(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.users).toEqual([])
  })

  it('returns 200 with mapped user list', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findMany.mockResolvedValue([BASE_USER])
    const req = new NextRequest('http://localhost/api/admin/users')
    const res = await listUsers(req)
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].mail).toBe('user@example.com')
    expect(body.users[0].role).toBe('Customer')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/users/create
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/create', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest('http://localhost/api/admin/users/create', 'POST', {
      displayName: 'Bob',
      email: 'bob@example.com',
      password: 'secret123'
    })
    const res = await createUser(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing required fields', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest('http://localhost/api/admin/users/create', 'POST', {
      email: 'bob@example.com'
    })
    const res = await createUser(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/missing required/i)
  })

  it('returns 400 when email is already taken', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    const req = jsonRequest('http://localhost/api/admin/users/create', 'POST', {
      displayName: 'Alice',
      email: 'user@example.com',
      password: 'secret123'
    })
    const res = await createUser(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already exists/i)
  })

  it('returns 200 with the new user on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      ...BASE_USER,
      email: 'bob@example.com',
      displayName: 'Bob'
    })
    const req = jsonRequest('http://localhost/api/admin/users/create', 'POST', {
      displayName: 'Bob',
      email: 'bob@example.com',
      password: 'secret123'
    })
    const res = await createUser(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.mail).toBe('bob@example.com')
    expect(body.user.displayName).toBe('Bob')
  })
})

// ---------------------------------------------------------------------------
// GET /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe('GET /api/admin/users/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com'
    )
    const res = await getUser(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/users/ghost@example.com'
    )
    const res = await getUser(req, params('ghost@example.com'))
    expect(res.status).toBe(404)
  })

  it('returns 200 with the user', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com'
    )
    const res = await getUser(req, params('user@example.com'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.mail).toBe('user@example.com')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com',
      'PATCH',
      { displayName: 'Updated' }
    )
    const res = await updateUser(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.update.mockRejectedValue(new Error('record not found'))
    const req = jsonRequest(
      'http://localhost/api/admin/users/ghost@example.com',
      'PATCH',
      { displayName: 'Updated' }
    )
    const res = await updateUser(req, params('ghost@example.com'))
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com',
      'PATCH',
      { displayName: 'Updated Name' }
    )
    const res = await updateUser(req, params('user@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/users/[id]', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com',
      { method: 'DELETE' }
    )
    const res = await deleteUser(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com',
      { method: 'DELETE' }
    )
    const res = await deleteUser(req, params('user@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/users/[id]/role
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[id]/role', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      'POST',
      { role: 'Employee' }
    )
    const res = await assignRole(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when role is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      'POST',
      {}
    )
    const res = await assignRole(req, params('user@example.com'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/role is required/i)
  })

  it('returns 400 for an invalid role value', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      'POST',
      { role: 'SuperUser' }
    )
    const res = await assignRole(req, params('user@example.com'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid role/i)
  })

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.update.mockRejectedValue(new Error('record not found'))
    const req = jsonRequest(
      'http://localhost/api/admin/users/ghost@example.com/role',
      'POST',
      { role: 'Employee' }
    )
    const res = await assignRole(req, params('ghost@example.com'))
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      'POST',
      { role: 'Employee' }
    )
    const res = await assignRole(req, params('user@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/[id]/role
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/users/[id]/role', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      { method: 'DELETE' }
    )
    const res = await removeRole(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 200 and resets role to Customer', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = new NextRequest(
      'http://localhost/api/admin/users/user@example.com/role',
      { method: 'DELETE' }
    )
    const res = await removeRole(req, params('user@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    const updateCall = mockPrisma.user.update.mock.calls[0][0]
    expect(updateCall.data.role).toBe('Customer')
  })
})

// ---------------------------------------------------------------------------
// POST /api/admin/users/[id]/reset-password
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[id]/reset-password', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/reset-password',
      'POST',
      { password: 'newPassword1' }
    )
    const res = await adminResetPassword(req, params('user@example.com'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when password is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/reset-password',
      'POST',
      {}
    )
    const res = await adminResetPassword(req, params('user@example.com'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/password is required/i)
  })

  it('returns 400 when password is too short', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/reset-password',
      'POST',
      { password: 'short' }
    )
    const res = await adminResetPassword(req, params('user@example.com'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/8 characters/i)
  })

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.update.mockRejectedValue(new Error('record not found'))
    const req = jsonRequest(
      'http://localhost/api/admin/users/ghost@example.com/reset-password',
      'POST',
      { password: 'newPassword1' }
    )
    const res = await adminResetPassword(req, params('ghost@example.com'))
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    const req = jsonRequest(
      'http://localhost/api/admin/users/user@example.com/reset-password',
      'POST',
      { password: 'newPassword1' }
    )
    const res = await adminResetPassword(req, params('user@example.com'))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })
})
