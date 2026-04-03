import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as forgotPassword } from '../auth/forgot-password/route'
import { POST as resetPassword } from '../auth/reset-password/route'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

function asyncOf<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

const { mockTableClient, mockBcrypt } = vi.hoisted(() => {
  const mockTableClient = {
    createTable: vi.fn(),
    createEntity: vi.fn(),
    getEntity: vi.fn(),
    listEntities: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn()
  }
  const mockBcrypt = { hash: vi.fn(), compare: vi.fn() }
  return { mockTableClient, mockBcrypt }
})
vi.mock('@azure/data-tables', () => ({
  TableClient: { fromConnectionString: vi.fn(() => mockTableClient) }
}))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

const { mockBeginSend } = vi.hoisted(() => ({
  mockBeginSend: vi.fn()
}))
vi.mock('@azure/communication-email', () => ({
  EmailClient: class {
    beginSend = mockBeginSend
  }
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_USER = {
  partitionKey: 'users',
  rowKey: 'user@example.com',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer',
  createdAt: '2024-01-01T00:00:00.000Z'
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

// Valid 64-char hex token
const VALID_TOKEN = 'a'.repeat(64)

// Token entity with future expiry
const TOKEN_ENTITY = {
  partitionKey: 'resets',
  rowKey: 'user@example.com',
  token: VALID_TOKEN,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockTableClient.createTable.mockResolvedValue({})
  mockTableClient.createEntity.mockResolvedValue({})
  mockTableClient.updateEntity.mockResolvedValue({})
  mockTableClient.deleteEntity.mockResolvedValue({})
  mockTableClient.listEntities.mockReturnValue(asyncOf())
  mockBcrypt.hash.mockResolvedValue('$newhashed')
  mockBcrypt.compare.mockResolvedValue(false)
  mockBeginSend.mockResolvedValue({ pollUntilDone: vi.fn().mockResolvedValue({}) })
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.AZURE_STORAGE_CONNECTION_STRING = 'mock-connection-string'
  process.env.AZURE_COMMUNICATION_CONNECTION_STRING = 'mock-acs-connection'
  process.env.ACS_SENDER_ADDRESS = 'DoNotReply@mock.azurecomm.net'
})

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /api/auth/forgot-password', () => {
  it('returns 400 when email is missing', async () => {
    const req = jsonRequest('http://localhost/api/auth/forgot-password', {})
    const res = await forgotPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/email is required/i)
  })

  it('returns 400 when email is not a string', async () => {
    const req = jsonRequest('http://localhost/api/auth/forgot-password', {
      email: 123
    })
    const res = await forgotPassword(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 and sends no email when user does not exist', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })
    const req = jsonRequest('http://localhost/api/auth/forgot-password', {
      email: 'ghost@example.com'
    })
    const res = await forgotPassword(req)
    expect(res.status).toBe(200)
    expect(mockBeginSend).not.toHaveBeenCalled()
  })

  it('returns 200 and sends a reset email when user exists', async () => {
    mockTableClient.getEntity.mockResolvedValue(BASE_USER)
    mockTableClient.deleteEntity.mockRejectedValue({ statusCode: 404 })
    const req = jsonRequest('http://localhost/api/auth/forgot-password', {
      email: 'user@example.com'
    })
    const res = await forgotPassword(req)
    expect(res.status).toBe(200)
    expect(mockBeginSend).toHaveBeenCalledOnce()
    const emailArgs = mockBeginSend.mock.calls[0][0]
    expect(emailArgs.recipients.to[0].address).toBe('user@example.com')
    expect(emailArgs.content.subject).toMatch(/reset/i)
  })
})

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when token or password is missing', async () => {
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: VALID_TOKEN
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/token and password/i)
  })

  it('returns 400 when password is too short', async () => {
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: VALID_TOKEN,
      password: 'short'
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/8 characters/i)
  })

  it('returns 400 for an invalid token format', async () => {
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: 'not-a-valid-hex-token',
      password: 'newPassword1'
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid or expired/i)
  })

  it('returns 400 when token is not found in storage', async () => {
    mockTableClient.listEntities.mockReturnValue(asyncOf())
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: VALID_TOKEN,
      password: 'newPassword1'
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid or expired/i)
  })

  it('returns 400 when token is expired', async () => {
    const expiredEntity = {
      ...TOKEN_ENTITY,
      expiresAt: new Date(Date.now() - 1000).toISOString()
    }
    mockTableClient.listEntities.mockReturnValue(asyncOf(expiredEntity))
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: VALID_TOKEN,
      password: 'newPassword1'
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/invalid or expired/i)
  })

  it('returns 200 and changes the password on success', async () => {
    mockTableClient.listEntities.mockReturnValue(asyncOf(TOKEN_ENTITY))
    mockTableClient.getEntity.mockResolvedValue(BASE_USER)
    const req = jsonRequest('http://localhost/api/auth/reset-password', {
      token: VALID_TOKEN,
      password: 'newPassword1'
    })
    const res = await resetPassword(req)
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockBcrypt.hash).toHaveBeenCalledWith('newPassword1', 10)
  })
})
