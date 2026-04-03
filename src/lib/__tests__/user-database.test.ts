import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changePassword,
  createUser,
  deleteUser,
  getAllUsers,
  getUserByEmail,
  initUserTable,
  updateUser,
  verifyUserCredentials
} from '../user-database'

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
  const mockBcrypt = {
    hash: vi.fn(),
    compare: vi.fn()
  }
  return { mockTableClient, mockBcrypt }
})

vi.mock('@azure/data-tables', () => ({
  TableClient: {
    fromConnectionString: vi.fn(() => mockTableClient)
  }
}))

vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

const baseUserEntity = {
  rowKey: 'user@example.com',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer',
  createdAt: '2024-01-01T00:00:00.000Z'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTableClient.listEntities.mockReturnValue(asyncOf())
  mockTableClient.createTable.mockResolvedValue({})
  mockTableClient.createEntity.mockResolvedValue({})
  mockTableClient.updateEntity.mockResolvedValue({})
  mockTableClient.deleteEntity.mockResolvedValue({})
  mockBcrypt.hash.mockResolvedValue('$hashed')
  mockBcrypt.compare.mockResolvedValue(false)
})

describe('initUserTable', () => {
  it('creates the table successfully', async () => {
    await expect(initUserTable()).resolves.toBeUndefined()
    expect(mockTableClient.createTable).toHaveBeenCalledOnce()
  })

  it('silently ignores a 409 (table already exists)', async () => {
    mockTableClient.createTable.mockRejectedValue({ statusCode: 409 })
    await expect(initUserTable()).resolves.toBeUndefined()
  })
})

describe('createUser', () => {
  it('creates and returns the new user', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })

    const user = await createUser({
      email: 'user@example.com',
      password: 'secret',
      displayName: 'Alice'
    })

    expect(user).not.toBeNull()
    expect(user?.email).toBe('user@example.com')
    expect(user?.displayName).toBe('Alice')
    expect(user?.role).toBe('Customer')
    expect(mockBcrypt.hash).toHaveBeenCalledWith('secret', 10)
  })

  it('returns null when the email is already taken', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)

    const user = await createUser({
      email: 'user@example.com',
      password: 'secret',
      displayName: 'Alice'
    })

    expect(user).toBeNull()
    expect(mockTableClient.createEntity).not.toHaveBeenCalled()
  })

  it('returns null on unexpected errors', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 500 })
    const user = await createUser({
      email: 'user@example.com',
      password: 'secret',
      displayName: 'Alice'
    })
    expect(user).toBeNull()
  })
})

describe('verifyUserCredentials', () => {
  it('returns the user when credentials are correct', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)
    mockBcrypt.compare.mockResolvedValue(true)

    const user = await verifyUserCredentials('user@example.com', 'secret')

    expect(user).not.toBeNull()
    expect(user?.email).toBe('user@example.com')
  })

  it('returns null when the password is wrong', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)
    mockBcrypt.compare.mockResolvedValue(false)

    const user = await verifyUserCredentials('user@example.com', 'wrong')
    expect(user).toBeNull()
  })

  it('returns null when the user does not exist (404)', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })
    const user = await verifyUserCredentials('ghost@example.com', 'secret')
    expect(user).toBeNull()
  })
})

describe('getUserByEmail', () => {
  it('returns the user when found', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)

    const user = await getUserByEmail('user@example.com')

    expect(user?.email).toBe('user@example.com')
    expect(user?.displayName).toBe('Alice')
  })

  it('returns null when the user does not exist (404)', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })
    expect(await getUserByEmail('ghost@example.com')).toBeNull()
  })
})

describe('getAllUsers', () => {
  it('returns an empty array when there are no users', async () => {
    expect(await getAllUsers()).toEqual([])
  })

  it('maps table entities to UserData objects', async () => {
    mockTableClient.listEntities.mockReturnValue(asyncOf(baseUserEntity))

    const users = await getAllUsers()

    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('user@example.com')
  })
})

describe('updateUser', () => {
  it('updates the user and returns true', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)

    const result = await updateUser('user@example.com', { displayName: 'Bob' })

    expect(result).toBe(true)
    expect(mockTableClient.updateEntity).toHaveBeenCalledOnce()
    const entity = mockTableClient.updateEntity.mock.calls[0][0]
    expect(entity.displayName).toBe('Bob')
  })

  it('returns false when the user is not found', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })
    expect(await updateUser('ghost@example.com', { role: 'Admin' })).toBe(false)
  })
})

describe('deleteUser', () => {
  it('deletes the user and returns true', async () => {
    const result = await deleteUser('user@example.com')
    expect(result).toBe(true)
    expect(mockTableClient.deleteEntity).toHaveBeenCalledWith(
      'users',
      'user@example.com'
    )
  })

  it('returns true even when the user does not exist (404)', async () => {
    mockTableClient.deleteEntity.mockRejectedValue({ statusCode: 404 })
    expect(await deleteUser('ghost@example.com')).toBe(true)
  })
})

describe('changePassword', () => {
  it('hashes the new password and updates the entity', async () => {
    mockTableClient.getEntity.mockResolvedValue(baseUserEntity)
    mockBcrypt.hash.mockResolvedValue('$newhashed')

    const result = await changePassword('user@example.com', 'newSecret')

    expect(result).toBe(true)
    expect(mockBcrypt.hash).toHaveBeenCalledWith('newSecret', 10)
    const entity = mockTableClient.updateEntity.mock.calls[0][0]
    expect(entity.passwordHash).toBe('$newhashed')
  })

  it('returns false when the user does not exist', async () => {
    mockTableClient.getEntity.mockRejectedValue({ statusCode: 404 })
    expect(await changePassword('ghost@example.com', 'pass')).toBe(false)
  })
})
