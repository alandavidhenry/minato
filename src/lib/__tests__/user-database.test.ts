import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changePassword,
  createUser,
  deleteUser,
  getAllUsers,
  getUserByEmail,
  getUserById,
  updateUser,
  verifyUserCredentials
} from '../user-database'

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
  const mockBcrypt = {
    hash: vi.fn(),
    compare: vi.fn()
  }
  return { mockPrisma, mockBcrypt }
})

vi.mock('../prisma', () => ({ default: mockPrisma }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

const BASE_USER = {
  id: 'cuid_abc123',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  tenantId: null,
  customerCompanyId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBcrypt.hash.mockResolvedValue('$hashed')
  mockBcrypt.compare.mockResolvedValue(false)
})

describe('createUser', () => {
  it('creates and returns the new user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue(BASE_USER)

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
    expect(user?.createdAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('returns null when the email is already taken', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)

    const user = await createUser({
      email: 'user@example.com',
      password: 'secret',
      displayName: 'Alice'
    })

    expect(user).toBeNull()
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('returns null on unexpected errors', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db error'))
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
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockBcrypt.compare.mockResolvedValue(true)

    const user = await verifyUserCredentials('user@example.com', 'secret')

    expect(user).not.toBeNull()
    expect(user?.email).toBe('user@example.com')
  })

  it('returns null when the password is wrong', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockBcrypt.compare.mockResolvedValue(false)

    const user = await verifyUserCredentials('user@example.com', 'wrong')
    expect(user).toBeNull()
  })

  it('returns null when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const user = await verifyUserCredentials('ghost@example.com', 'secret')
    expect(user).toBeNull()
  })
})

describe('getUserByEmail', () => {
  it('returns the user when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)

    const user = await getUserByEmail('user@example.com')

    expect(user?.email).toBe('user@example.com')
    expect(user?.displayName).toBe('Alice')
  })

  it('returns null when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect(await getUserByEmail('ghost@example.com')).toBeNull()
  })
})

describe('getUserById', () => {
  it('returns the user when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)

    const user = await getUserById('cuid_abc123')

    expect(user?.id).toBe('cuid_abc123')
    expect(user?.email).toBe('user@example.com')
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' }
    })
  })

  it('returns null when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    expect(await getUserById('nonexistent')).toBeNull()
  })
})

describe('getAllUsers', () => {
  it('returns an empty array when there are no users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    expect(await getAllUsers()).toEqual([])
  })

  it('maps Prisma users to UserData objects', async () => {
    mockPrisma.user.findMany.mockResolvedValue([BASE_USER])

    const users = await getAllUsers()

    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('user@example.com')
    expect(users[0].id).toBe('cuid_abc123')
    expect(users[0].createdAt).toBe('2024-01-01T00:00:00.000Z')
  })
})

describe('updateUser', () => {
  it('updates the user and returns true', async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      displayName: 'Bob'
    })

    const result = await updateUser('cuid_abc123', { displayName: 'Bob' })

    expect(result).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { displayName: 'Bob' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('not found'))
    expect(await updateUser('nonexistent', { role: 'Admin' })).toBe(false)
  })
})

describe('deleteUser', () => {
  it('deletes the user and returns true', async () => {
    mockPrisma.user.delete.mockResolvedValue(BASE_USER)
    const result = await deleteUser('cuid_abc123')
    expect(result).toBe(true)
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.delete.mockRejectedValue(new Error('not found'))
    expect(await deleteUser('nonexistent')).toBe(false)
  })
})

describe('changePassword', () => {
  it('hashes the new password and updates the user', async () => {
    mockBcrypt.hash.mockResolvedValue('$newhashed')
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      passwordHash: '$newhashed'
    })

    const result = await changePassword('cuid_abc123', 'newSecret')

    expect(result).toBe(true)
    expect(mockBcrypt.hash).toHaveBeenCalledWith('newSecret', 10)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { passwordHash: '$newhashed' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('not found'))
    expect(await changePassword('nonexistent', 'pass')).toBe(false)
  })
})
