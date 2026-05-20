import bcrypt from 'bcryptjs'

import prisma from './prisma'

export interface UserData {
  id: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  jobRole: string | null
  createdAt: string
  customerCompanyId: string | null
}

type PrismaUser = {
  id: string
  email: string
  displayName: string
  passwordHash: string
  role: string
  jobRole: string | null
  createdAt: Date
  customerCompanyId: string | null
}

function toUserData(user: PrismaUser): UserData {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    role: user.role,
    jobRole: user.jobRole,
    createdAt: user.createdAt.toISOString(),
    customerCompanyId: user.customerCompanyId
  }
}

export async function createUser({
  email,
  password,
  displayName,
  role = 'Customer User',
  jobRole,
  customerCompanyId
}: {
  email: string
  password: string
  displayName: string
  role?: string
  jobRole?: string
  customerCompanyId?: string
}): Promise<UserData | null> {
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return null

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        role,
        jobRole: jobRole ?? null,
        customerCompanyId
      }
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

export async function getUserById(id: string): Promise<UserData | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
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

export async function getUsersByCompany(
  customerCompanyId: string
): Promise<UserData[]> {
  try {
    const users = await prisma.user.findMany({
      where: { customerCompanyId },
      orderBy: { displayName: 'asc' }
    })
    return users.map(toUserData)
  } catch (error) {
    console.error('Error getting users by company:', error)
    return []
  }
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<UserData, 'id' | 'email' | 'passwordHash'>>
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id },
      data: {
        ...(updates.displayName !== undefined && {
          displayName: updates.displayName
        }),
        ...(updates.role !== undefined && { role: updates.role }),
        ...(updates.jobRole !== undefined && { jobRole: updates.jobRole }),
        ...(updates.customerCompanyId !== undefined && {
          customerCompanyId: updates.customerCompanyId
        })
      }
    })
    return true
  } catch (error) {
    console.error('Error updating user:', error)
    return false
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await prisma.user.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting user:', error)
    return false
  }
}

export async function changePassword(
  id: string,
  newPassword: string
): Promise<boolean> {
  try {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return true
  } catch (error) {
    console.error('Error changing password:', error)
    return false
  }
}
