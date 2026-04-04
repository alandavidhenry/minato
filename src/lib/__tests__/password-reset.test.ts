import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createResetToken,
  deleteResetToken,
  validateResetToken
} from '../password-reset'

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    passwordReset: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn()
    }
  }
  return { mockPrisma }
})

vi.mock('../prisma', () => ({ default: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.passwordReset.upsert.mockResolvedValue({})
  mockPrisma.passwordReset.delete.mockResolvedValue({})
})

describe('validateResetToken', () => {
  it('returns null immediately for tokens that are not 64 hex characters', async () => {
    expect(await validateResetToken('tooshort')).toBeNull()
    expect(await validateResetToken('z'.repeat(64))).toBeNull() // non-hex char
    expect(mockPrisma.passwordReset.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when no token matches', async () => {
    mockPrisma.passwordReset.findUnique.mockResolvedValue(null)
    expect(await validateResetToken('a'.repeat(64))).toBeNull()
  })

  it('returns the email for a valid, non-expired token', async () => {
    const validHex = 'b'.repeat(64)
    mockPrisma.passwordReset.findUnique.mockResolvedValue({
      id: 'cuid_1',
      email: 'user@example.com',
      token: validHex,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date()
    })

    const email = await validateResetToken(validHex)
    expect(email).toBe('user@example.com')
    expect(mockPrisma.passwordReset.delete).not.toHaveBeenCalled()
  })

  it('returns null and deletes the record for an expired token', async () => {
    const validHex = 'c'.repeat(64)
    mockPrisma.passwordReset.findUnique.mockResolvedValue({
      id: 'cuid_2',
      email: 'user@example.com',
      token: validHex,
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date()
    })

    const email = await validateResetToken(validHex)
    expect(email).toBeNull()
    expect(mockPrisma.passwordReset.delete).toHaveBeenCalledWith({
      where: { token: validHex }
    })
  })
})

describe('createResetToken', () => {
  it('returns a 64-character hex token', async () => {
    const token = await createResetToken('user@example.com')
    expect(token).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('upserts the token record', async () => {
    await createResetToken('user@example.com')
    expect(mockPrisma.passwordReset.upsert).toHaveBeenCalledOnce()
    const call = mockPrisma.passwordReset.upsert.mock.calls[0][0]
    expect(call.where.email).toBe('user@example.com')
    expect(call.create.token).toMatch(/^[0-9a-f]{64}$/u)
    expect(call.update.token).toMatch(/^[0-9a-f]{64}$/u)
  })
})

describe('deleteResetToken', () => {
  it('deletes the record by email', async () => {
    await deleteResetToken('user@example.com')
    expect(mockPrisma.passwordReset.delete).toHaveBeenCalledWith({
      where: { email: 'user@example.com' }
    })
  })

  it('does not throw when the record does not exist', async () => {
    mockPrisma.passwordReset.delete.mockRejectedValue(new Error('not found'))
    await expect(
      deleteResetToken('missing@example.com')
    ).resolves.toBeUndefined()
  })
})
