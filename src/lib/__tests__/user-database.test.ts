import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changePassword,
  createUser,
  deleteUser,
  getAllUsers,
  getUserByEmail,
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
  tenantId: null
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

    const result = await updateUser('user@example.com', { displayName: 'Bob' })

    expect(result).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { displayName: 'Bob' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('not found'))
    expect(await updateUser('ghost@example.com', { role: 'Admin' })).toBe(false)
  })
})

describe('deleteUser', () => {
  it('deletes the user and returns true', async () => {
    mockPrisma.user.delete.mockResolvedValue(BASE_USER)
    const result = await deleteUser('user@example.com')
    expect(result).toBe(true)
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { email: 'user@example.com' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.delete.mockRejectedValue(new Error('not found'))
    expect(await deleteUser('ghost@example.com')).toBe(false)
  })
})

describe('changePassword', () => {
  it('hashes the new password and updates the user', async () => {
    mockBcrypt.hash.mockResolvedValue('$newhashed')
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      passwordHash: '$newhashed'
    })

    const result = await changePassword('user@example.com', 'newSecret')

    expect(result).toBe(true)
    expect(mockBcrypt.hash).toHaveBeenCalledWith('newSecret', 10)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      data: { passwordHash: '$newhashed' }
    })
  })

  it('returns false when an error occurs', async () => {
    mockPrisma.user.update.mockRejectedValue(new Error('not found'))
    expect(await changePassword('ghost@example.com', 'pass')).toBe(false)
  })
})
