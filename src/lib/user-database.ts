import { TableClient } from '@azure/data-tables'
import bcrypt from 'bcryptjs'

export interface UserData {
  id: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  createdAt: string
}

interface UserTableEntity {
  partitionKey: string
  rowKey: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  createdAt: string
  [key: string]: string | undefined
}

interface StorageError {
  statusCode?: number
  [key: string]: unknown
}

interface UpdateEntity {
  partitionKey: string
  rowKey: string
  displayName?: string
  role?: string
}

function getTableClient() {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'users'
    )
  }

  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'users'
  )
}

export async function initUserTable() {
  const tableClient = getTableClient()
  try {
    await tableClient.createTable()
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 409) {
      return
    }
    console.error('Error creating users table:', error)
  }
}

export async function createUser({
  email,
  password,
  displayName,
  role = 'Customer'
}: {
  email: string
  password: string
  displayName: string
  role?: string
}): Promise<UserData | null> {
  const tableClient = getTableClient()

  try {
    try {
      await tableClient.getEntity('users', email)
      return null
    } catch (error) {
      const storageError = error as StorageError
      // 404 means user doesn't exist — expected, continue with creation
      if (storageError.statusCode !== 404) {
        throw error
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const now = new Date().toISOString()

    await tableClient.createEntity({
      partitionKey: 'users',
      rowKey: email,
      email,
      displayName,
      passwordHash,
      role,
      createdAt: now
    })

    return { id: email, email, displayName, passwordHash, role, createdAt: now }
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<UserData | null> {
  const tableClient = getTableClient()

  try {
    const userEntity = (await tableClient.getEntity(
      'users',
      email
    )) as unknown as UserTableEntity

    const passwordMatch = await bcrypt.compare(
      password,
      userEntity.passwordHash
    )

    if (passwordMatch) {
      return {
        id: userEntity.rowKey,
        email: userEntity.email,
        displayName: userEntity.displayName,
        passwordHash: userEntity.passwordHash,
        role: userEntity.role,
        createdAt: userEntity.createdAt
      }
    }

    return null
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 404) {
      return null
    }
    console.error('Error verifying user:', error)
    return null
  }
}

export async function getUserByEmail(email: string): Promise<UserData | null> {
  const tableClient = getTableClient()

  try {
    const user = await tableClient.getEntity('users', email)

    return {
      id: user.rowKey as string,
      email: user.email as string,
      displayName: user.displayName as string,
      passwordHash: user.passwordHash as string,
      role: user.role as string,
      createdAt: user.createdAt as string
    }
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 404) {
      return null
    }
    console.error('Error getting user:', error)
    return null
  }
}

export async function getAllUsers(): Promise<UserData[]> {
  const tableClient = getTableClient()
  const users: UserData[] = []

  try {
    const iterator = tableClient.listEntities({
      queryOptions: { filter: "PartitionKey eq 'users'" }
    })

    for await (const user of iterator) {
      users.push({
        id: user.rowKey as string,
        email: user.email as string,
        displayName: user.displayName as string,
        passwordHash: user.passwordHash as string,
        role: user.role as string,
        createdAt: user.createdAt as string
      })
    }

    return users
  } catch (error) {
    console.error('Error getting all users:', error)
    return []
  }
}

export async function updateUser(
  email: string,
  updates: Partial<Omit<UserData, 'id' | 'email' | 'passwordHash'>>
): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    await tableClient.getEntity('users', email)

    const updateEntity: UpdateEntity = {
      partitionKey: 'users',
      rowKey: email
    }

    if (updates.displayName !== undefined)
      updateEntity.displayName = updates.displayName
    if (updates.role !== undefined) updateEntity.role = updates.role

    await tableClient.updateEntity(updateEntity, 'Merge')

    return true
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 404) {
      console.error('User not found for update:', email)
      return false
    }
    console.error('Error updating user:', error)
    return false
  }
}

export async function deleteUser(email: string): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    await tableClient.deleteEntity('users', email)
    return true
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 404) {
      return true
    }
    console.error('Error deleting user:', error)
    return false
  }
}

export async function changePassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    await tableClient.getEntity('users', email)

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await tableClient.updateEntity(
      { partitionKey: 'users', rowKey: email, passwordHash },
      'Merge'
    )

    return true
  } catch (error) {
    const storageError = error as StorageError
    if (storageError.statusCode === 404) {
      console.error('User not found for password change:', email)
      return false
    }
    console.error('Error changing password:', error)
    return false
  }
}
