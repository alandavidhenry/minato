import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as register } from '../auth/register/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn()
}))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

const { mockCreateUser } = vi.hoisted(() => ({
  mockCreateUser: vi.fn()
}))
vi.mock('@/lib/user-database', () => ({ createUser: mockCreateUser }))

const { mockEnrollUser } = vi.hoisted(() => ({
  mockEnrollUser: vi.fn()
}))
vi.mock('@/lib/assignments', () => ({
  enrollUserInMatchingAssignments: mockEnrollUser
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = { user: { roles: ['Tenant Admin'] } }

const BASE_USER = {
  id: 'user_123',
  email: 'bob@example.com',
  displayName: 'Bob',
  role: 'Customer User',
  jobRole: null,
  lineManagerId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: null
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateUser.mockResolvedValue(BASE_USER)
  mockEnrollUser.mockResolvedValue([])
})

describe('POST /api/auth/register', () => {
  it('returns 403 when not admin', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await register(jsonRequest({ displayName: 'Bob' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when displayName is missing', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await register(jsonRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when email is provided without a password', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await register(
      jsonRequest({ displayName: 'Bob', email: 'bob@example.com' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/password is required/i)
  })

  it('returns 400 for a no-email worker with no line manager', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await register(jsonRequest({ displayName: 'Worker' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/line manager/i)
  })

  it('returns 400 when createUser fails (duplicate email)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreateUser.mockResolvedValue(null)
    const res = await register(
      jsonRequest({
        displayName: 'Bob',
        email: 'bob@example.com',
        password: 'secret123'
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 200 with the new user on success', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    const res = await register(
      jsonRequest({
        displayName: 'Bob',
        email: 'bob@example.com',
        password: 'secret123'
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.displayName).toBe('Bob')
  })

  it('enrolls the new user in matching auto-enroll assignments when a company is set', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreateUser.mockResolvedValue({
      ...BASE_USER,
      jobRole: 'Site Manager',
      customerCompanyId: 'company_123'
    })
    const res = await register(
      jsonRequest({
        displayName: 'Bob',
        email: 'bob@example.com',
        password: 'secret123',
        jobRole: 'Site Manager',
        customerCompanyId: 'company_123'
      })
    )
    expect(res.status).toBe(200)
    expect(mockEnrollUser).toHaveBeenCalledWith(
      'user_123',
      'company_123',
      'Site Manager'
    )
  })

  it('does not attempt enrollment when the user has no company (consultancy staff)', async () => {
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)
    mockCreateUser.mockResolvedValue({ ...BASE_USER, customerCompanyId: null })
    const res = await register(
      jsonRequest({
        displayName: 'Alice',
        email: 'alice@example.com',
        password: 'secret123'
      })
    )
    expect(res.status).toBe(200)
    expect(mockEnrollUser).not.toHaveBeenCalled()
  })
})
