import bcrypt from 'bcryptjs'

import prisma from './prisma'

export interface UserData {
  id: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  createdAt: string
}

type PrismaUser = {
  id: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  createdAt: Date
}

function toUserData(user: PrismaUser): UserData {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    role: user.role,
    createdAt: user.createdAt.toISOString()
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
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return null

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: { email, displayName, passwordHash, role }
    })

    return toUserData(user)
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<UserData | null> {
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return null

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatch) return null

    return toUserData(user)
  } catch (error) {
    console.error('Error verifying user:', error)
    return null
  }
}

export async function getUserByEmail(email: string): Promise<UserData | null> {
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return null
    return toUserData(user)
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

export async function getAllUsers(): Promise<UserData[]> {
  try {
    const users = await prisma.user.findMany()
    return users.map(toUserData)
  } catch (error) {
    console.error('Error getting all users:', error)
    return []
  }
}

export async function updateUser(
  email: string,
  updates: Partial<Omit<UserData, 'id' | 'email' | 'passwordHash'>>
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { email },
      data: {
        ...(updates.displayName !== undefined && {
          displayName: updates.displayName
        }),
        ...(updates.role !== undefined && { role: updates.role })
      }
    })
    return true
  } catch (error) {
    console.error('Error updating user:', error)
    return false
  }
}

export async function deleteUser(email: string): Promise<boolean> {
  try {
    await prisma.user.delete({ where: { email } })
    return true
  } catch (error) {
    console.error('Error deleting user:', error)
    return false
  }
}

export async function changePassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { email }, data: { passwordHash } })
    return true
  } catch (error) {
    console.error('Error changing password:', error)
    return false
  }
}
