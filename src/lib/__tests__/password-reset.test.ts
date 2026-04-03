import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createResetToken,
  deleteResetToken,
  validateResetToken
} from '../password-reset'

function asyncOf<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

const { mockTableClient } = vi.hoisted(() => {
  const mockTableClient = {
    createTable: vi.fn(),
    createEntity: vi.fn(),
    listEntities: vi.fn(),
    deleteEntity: vi.fn()
  }
  return { mockTableClient }
})

vi.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: vi.fn(() => mockTableClient)
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockTableClient.listEntities.mockReturnValue(asyncOf())
  mockTableClient.createTable.mockResolvedValue({})
  mockTableClient.createEntity.mockResolvedValue({})
  mockTableClient.deleteEntity.mockResolvedValue({})
})

describe('validateResetToken', () => {
  it('returns null immediately for tokens that are not 64 hex characters', async () => {
    expect(await validateResetToken('tooshort')).toBeNull()
    expect(await validateResetToken('z'.repeat(64))).toBeNull() // non-hex char
    expect(mockTableClient.listEntities).not.toHaveBeenCalled()
  })

  it('returns null when no token matches', async () => {
    const validHex = 'a'.repeat(64)
    mockTableClient.listEntities.mockReturnValue(asyncOf())
    expect(await validateResetToken(validHex)).toBeNull()
  })

  it('returns the email (rowKey) for a valid, non-expired token', async () => {
    const validHex = 'b'.repeat(64)
    const entity = {
      rowKey: 'user@example.com',
      token: validHex,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }
    mockTableClient.listEntities.mockReturnValue(asyncOf(entity))

    const email = await validateResetToken(validHex)
    expect(email).toBe('user@example.com')
    expect(mockTableClient.deleteEntity).not.toHaveBeenCalled()
  })

  it('returns null and deletes the entity for an expired token', async () => {
    const validHex = 'c'.repeat(64)
    const entity = {
      rowKey: 'user@example.com',
      token: validHex,
      expiresAt: new Date(Date.now() - 60_000).toISOString()
    }
    mockTableClient.listEntities.mockReturnValue(asyncOf(entity))

    const email = await validateResetToken(validHex)
    expect(email).toBeNull()
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      'resets',
      'user@example.com'
    )
  })
})

describe('createResetToken', () => {
  it('returns a 64-character hex token', async () => {
    const token = await createResetToken('user@example.com')
    expect(token).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('stores the token in the table', async () => {
    await createResetToken('user@example.com')
    expect(mockTableClient.createEntity).toHaveBeenCalledOnce()
    const entity = mockTableClient.createEntity.mock.calls[0][0]
    expect(entity.partitionKey).toBe('resets')
    expect(entity.rowKey).toBe('user@example.com')
    expect(entity.token).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('deletes any existing token before creating a new one', async () => {
    await createResetToken('user@example.com')
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      'resets',
      'user@example.com'
    )
  })
})

describe('deleteResetToken', () => {
  it('calls deleteEntity with the correct partition and row key', async () => {
    await deleteResetToken('user@example.com')
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      'resets',
      'user@example.com'
    )
  })

  it('does not throw when the entity does not exist', async () => {
    mockTableClient.deleteEntity.mockRejectedValue(new Error('not found'))
    await expect(
      deleteResetToken('missing@example.com')
    ).resolves.toBeUndefined()
  })
})
