import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changePassword,
  createUser,
  deleteUser,
  getAllUsers,
  getProfilePermissions,
  getTenantProfilePermissions,
  getUserByEmail,
  getUserById,
  resolveEmailRecipients,
  updateProfilePermissions,
  updateUser,
  updateUserProfile,
  verifyUserCredentials,
  type UserData
} from '../user-database'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    passwordReset: {
      deleteMany: vi.fn()
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
  jobRole: null,
  lineManagerId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  tenantId: null,
  customerCompanyId: null
}

const NO_EMAIL_USER = {
  ...BASE_USER,
  id: 'cuid_noemail',
  email: null,
  passwordHash: null,
  displayName: 'Bob (no email)',
  lineManagerId: 'cuid_manager'
}

const MANAGER_USER = {
  ...BASE_USER,
  id: 'cuid_manager',
  email: 'manager@example.com',
  displayName: 'Manager'
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBcrypt.hash.mockResolvedValue('$hashed')
  mockBcrypt.compare.mockResolvedValue(false)
})

describe('createUser', () => {
  it('creates and returns the new user with email and password', async () => {
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

  it('creates a no-email worker without password hash', async () => {
    mockPrisma.user.create.mockResolvedValue(NO_EMAIL_USER)

    const user = await createUser({
      displayName: 'Bob (no email)',
      lineManagerId: 'cuid_manager'
    })

    expect(user).not.toBeNull()
    expect(user?.email).toBeNull()
    expect(user?.passwordHash).toBeNull()
    expect(user?.lineManagerId).toBe('cuid_manager')
    expect(mockBcrypt.hash).not.toHaveBeenCalled()
    // No email → skip duplicate check
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
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

  it('returns null for no-email workers (null passwordHash)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(NO_EMAIL_USER)
    const user = await verifyUserCredentials('anything@example.com', 'any')
    expect(user).toBeNull()
    expect(mockBcrypt.compare).not.toHaveBeenCalled()
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

  it('updates jobRole when provided', async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      jobRole: 'Site Manager'
    })

    const result = await updateUser('cuid_abc123', { jobRole: 'Site Manager' })

    expect(result).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { jobRole: 'Site Manager' }
    })
  })

  it('updates lineManagerId when provided', async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      lineManagerId: 'mgr_1'
    })

    const result = await updateUser('cuid_abc123', { lineManagerId: 'mgr_1' })

    expect(result).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { lineManagerId: 'mgr_1' }
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

// UserData-typed fixtures for resolveEmailRecipients (createdAt must be string)
const EMAIL_USER_DATA: UserData = {
  id: 'cuid_abc123',
  email: 'user@example.com',
  displayName: 'Alice',
  passwordHash: '$hashed',
  role: 'Customer',
  jobRole: null,
  lineManagerId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  customerCompanyId: null
}

const NO_EMAIL_USER_DATA: UserData = {
  ...EMAIL_USER_DATA,
  id: 'cuid_noemail',
  email: null,
  passwordHash: null,
  displayName: 'Bob (no email)',
  lineManagerId: 'cuid_manager'
}

describe('resolveEmailRecipients', () => {
  it('returns email users directly', async () => {
    const result = await resolveEmailRecipients([EMAIL_USER_DATA])
    expect(result).toEqual([{ email: 'user@example.com', name: 'Alice' }])
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('routes no-email users to their line manager', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MANAGER_USER)

    const result = await resolveEmailRecipients([NO_EMAIL_USER_DATA])

    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('manager@example.com')
    expect(result[0].name).toBe('Manager')
  })

  it('deduplicates when multiple no-email users share a line manager', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MANAGER_USER)

    const users: UserData[] = [
      { ...NO_EMAIL_USER_DATA, id: 'u1' },
      { ...NO_EMAIL_USER_DATA, id: 'u2' }
    ]
    const result = await resolveEmailRecipients(users)

    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('manager@example.com')
  })

  it('skips no-email users with no line manager', async () => {
    const noManagerUser: UserData = {
      ...NO_EMAIL_USER_DATA,
      lineManagerId: null
    }
    const result = await resolveEmailRecipients([noManagerUser])
    expect(result).toHaveLength(0)
  })

  it('skips no-email users whose line manager has no email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...MANAGER_USER,
      email: null
    })
    const result = await resolveEmailRecipients([NO_EMAIL_USER_DATA])
    expect(result).toHaveLength(0)
  })

  it('handles a mix of email and no-email users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MANAGER_USER)

    const users: UserData[] = [EMAIL_USER_DATA, NO_EMAIL_USER_DATA]
    const result = await resolveEmailRecipients(users)

    expect(result).toHaveLength(2)
    const emails = result.map((r) => r.email)
    expect(emails).toContain('user@example.com')
    expect(emails).toContain('manager@example.com')
  })
})

const BASE_TENANT = {
  id: 'tenant_1',
  name: 'Default Tenant',
  createdAt: new Date(),
  profilePermissions: null
}

describe('getProfilePermissions', () => {
  it('returns defaults when user has no tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...BASE_USER, tenant: null })
    const p = await getProfilePermissions('cuid_abc123')
    expect(p).toEqual({
      canEditDisplayName: true,
      canEditEmail: true,
      canEditJobRole: true
    })
  })

  it('returns defaults when tenant has no profilePermissions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: { ...BASE_TENANT, profilePermissions: null }
    })
    const p = await getProfilePermissions('cuid_abc123')
    expect(p.canEditDisplayName).toBe(true)
  })

  it('returns stored permissions from tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: {
        ...BASE_TENANT,
        profilePermissions: {
          canEditDisplayName: false,
          canEditEmail: true,
          canEditJobRole: false
        }
      }
    })
    const p = await getProfilePermissions('cuid_abc123')
    expect(p.canEditDisplayName).toBe(false)
    expect(p.canEditEmail).toBe(true)
    expect(p.canEditJobRole).toBe(false)
  })

  it('fills in missing keys with defaults', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...BASE_USER,
      tenant: {
        ...BASE_TENANT,
        profilePermissions: { canEditDisplayName: false }
      }
    })
    const p = await getProfilePermissions('cuid_abc123')
    expect(p.canEditDisplayName).toBe(false)
    expect(p.canEditEmail).toBe(true)
    expect(p.canEditJobRole).toBe(true)
  })
})

describe('getTenantProfilePermissions', () => {
  it('returns defaults when tenant not found', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null)
    const p = await getTenantProfilePermissions('tenant_1')
    expect(p).toEqual({
      canEditDisplayName: true,
      canEditEmail: true,
      canEditJobRole: true
    })
  })

  it('returns stored permissions', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...BASE_TENANT,
      profilePermissions: {
        canEditDisplayName: true,
        canEditEmail: false,
        canEditJobRole: true
      }
    })
    const p = await getTenantProfilePermissions('tenant_1')
    expect(p.canEditEmail).toBe(false)
  })
})

describe('updateProfilePermissions', () => {
  it('merges partial updates with existing permissions', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...BASE_TENANT,
      profilePermissions: {
        canEditDisplayName: true,
        canEditEmail: true,
        canEditJobRole: true
      }
    })
    mockPrisma.tenant.update.mockResolvedValue(BASE_TENANT)

    const result = await updateProfilePermissions('tenant_1', {
      canEditEmail: false
    })

    expect(result).toBe(true)
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant_1' },
      data: {
        profilePermissions: {
          canEditDisplayName: true,
          canEditEmail: false,
          canEditJobRole: true
        }
      }
    })
  })

  it('returns false on error', async () => {
    mockPrisma.tenant.findUnique.mockRejectedValue(new Error('db error'))
    const result = await updateProfilePermissions('tenant_1', {
      canEditDisplayName: false
    })
    expect(result).toBe(false)
  })
})

describe('updateUserProfile', () => {
  it('updates display name', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      displayName: 'Bob'
    })

    const result = await updateUserProfile('cuid_abc123', {
      displayName: 'Bob'
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { displayName: 'Bob' }
    })
  })

  it('validates current password before changing password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockBcrypt.compare.mockResolvedValue(false)

    const result = await updateUserProfile('cuid_abc123', {
      currentPassword: 'wrong',
      newPassword: 'newpass'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('WRONG_PASSWORD')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('changes password when current password is correct', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(BASE_USER)
    mockBcrypt.compare.mockResolvedValue(true)
    mockBcrypt.hash.mockResolvedValue('$newhashed')
    mockPrisma.user.update.mockResolvedValue(BASE_USER)

    const result = await updateUserProfile('cuid_abc123', {
      currentPassword: 'secret',
      newPassword: 'newSecret'
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { passwordHash: '$newhashed' }
    })
  })

  it('rejects email change when new email is already taken', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(BASE_USER) // initial user lookup
      .mockResolvedValueOnce({ ...BASE_USER, id: 'other_id' }) // email conflict check

    const result = await updateUserProfile('cuid_abc123', {
      email: 'taken@example.com'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('EMAIL_TAKEN')
  })

  it('deletes password reset and updates email when email changes', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(BASE_USER) // initial user lookup
      .mockResolvedValueOnce(null) // email uniqueness check — not taken
    mockPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.user.update.mockResolvedValue({
      ...BASE_USER,
      email: 'new@example.com'
    })

    const result = await updateUserProfile('cuid_abc123', {
      email: 'new@example.com'
    })

    expect(result.success).toBe(true)
    expect(mockPrisma.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: { email: 'user@example.com' }
    })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cuid_abc123' },
      data: { email: 'new@example.com' }
    })
  })

  it('returns USER_NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await updateUserProfile('nonexistent', { displayName: 'X' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('USER_NOT_FOUND')
  })

  it('returns DB_ERROR on unexpected exception', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('db error'))
    const result = await updateUserProfile('cuid_abc123', {
      displayName: 'X'
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('DB_ERROR')
  })
})
