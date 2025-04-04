// src/lib/user-database.ts
import { TableClient } from '@azure/data-tables'
import bcrypt from 'bcryptjs'

// User interface
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

// Get a TableClient instance to work with the users table
function getTableClient() {
  // For local development with Azurite, use the development storage
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.USE_AZURITE === 'true'
  ) {
    return TableClient.fromConnectionString(
      'UseDevelopmentStorage=true',
      'users'
    )
  }

  // For production, use your Azure Storage account
  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!,
    'users'
  )
}

// Initialize the table if it doesn't exist
export async function initUserTable() {
  const tableClient = getTableClient()
  try {
    await tableClient.createTable()
    console.log('Users table created or already exists')
  } catch (error: any) {
    // If the table already exists, that's fine
    if (error.statusCode === 409) {
      console.log('Users table already exists')
      return
    }
    console.error('Error creating users table:', error)
  }
}

// Create a new user
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
    // Check if user already exists
    try {
      await tableClient.getEntity('users', email)
      console.log('User already exists:', email)
      return null
    } catch (error: any) {
      // Error 404 means the user doesn't exist, which is what we want
      if (error.statusCode !== 404) {
        throw error
      }
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user entity
    const now = new Date().toISOString()
    const user = {
      partitionKey: 'users',
      rowKey: email,
      email,
      displayName,
      passwordHash,
      role,
      createdAt: now
    }

    // Save to Azure Table Storage
    await tableClient.createEntity(user)

    return {
      id: email,
      email,
      displayName,
      passwordHash,
      role,
      createdAt: now
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

// Verify user credentials
export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<UserData | null> {
  const tableClient = getTableClient()

  try {
    // Get user by email with type assertion
    const userEntity = (await tableClient.getEntity(
      'users',
      email
    )) as unknown as UserTableEntity

    // Now TypeScript knows passwordHash is a string
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
  } catch (error: any) {
    // If user doesn't exist, return null
    if (error.statusCode === 404) {
      return null
    }
    console.error('Error verifying user:', error)
    return null
  }
}

// Get user by email
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
  } catch (error: any) {
    // If user doesn't exist, return null
    if (error.statusCode === 404) {
      return null
    }
    console.error('Error getting user:', error)
    return null
  }
}

// Get all users
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

// Update user
export async function updateUser(
  email: string,
  updates: Partial<Omit<UserData, 'id' | 'email' | 'passwordHash'>>
): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    // Check if the user exists
    await tableClient.getEntity('users', email)

    // Create the update entity
    const updateEntity: any = {
      partitionKey: 'users',
      rowKey: email
    }

    // Add only the fields that need to be updated
    if (updates.displayName) updateEntity.displayName = updates.displayName
    if (updates.role) updateEntity.role = updates.role

    // Update the entity
    await tableClient.updateEntity(updateEntity, 'Merge')

    return true
  } catch (error: any) {
    // If user doesn't exist, return false
    if (error.statusCode === 404) {
      console.error('User not found for update:', email)
      return false
    }
    console.error('Error updating user:', error)
    return false
  }
}

// Delete user
export async function deleteUser(email: string): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    await tableClient.deleteEntity('users', email)
    return true
  } catch (error: any) {
    // If user doesn't exist, consider it a success
    if (error.statusCode === 404) {
      return true
    }
    console.error('Error deleting user:', error)
    return false
  }
}

// Change user password
export async function changePassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  const tableClient = getTableClient()

  try {
    // Check if the user exists
    await tableClient.getEntity('users', email)

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update the password
    await tableClient.updateEntity(
      {
        partitionKey: 'users',
        rowKey: email,
        passwordHash
      },
      'Merge'
    )

    return true
  } catch (error: any) {
    // If user doesn't exist, return false
    if (error.statusCode === 404) {
      console.error('User not found for password change:', email)
      return false
    }
    console.error('Error changing password:', error)
    return false
  }
}
