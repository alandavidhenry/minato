import bcrypt from 'bcryptjs'

import { Prisma } from '@/generated/prisma/client'

import prisma from './prisma'

export interface ProfilePermissions {
  canEditDisplayName: boolean
  canEditEmail: boolean
  canEditJobRole: boolean
}

export const DEFAULT_PROFILE_PERMISSIONS: ProfilePermissions = {
  canEditDisplayName: true,
  canEditEmail: true,
  canEditJobRole: true
}

export interface UserData {
  id: string
  email: string | null
  displayName: string
  passwordHash: string | null
  role: string
  jobRole: string | null
  lineManagerId: string | null
  createdAt: string
  customerCompanyId: string | null
}

type PrismaUser = {
  id: string
  email: string | null
  displayName: string
  passwordHash: string | null
  role: string
  jobRole: string | null
  lineManagerId: string | null
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
    lineManagerId: user.lineManagerId,
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
  customerCompanyId,
  lineManagerId
}: {
  email?: string
  password?: string
  displayName: string
  role?: string
  jobRole?: string
  customerCompanyId?: string
  lineManagerId?: string
}): Promise<UserData | null> {
  try {
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return null
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null

    const user = await prisma.user.create({
      data: {
        email: email ?? null,
        displayName,
        passwordHash,
        role,
        jobRole: jobRole ?? null,
        customerCompanyId,
        lineManagerId: lineManagerId ?? null
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
    // No-email workers have no passwordHash and cannot log in
    if (!user.passwordHash) return null

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

export async function getNoEmailUsersByCompany(
  customerCompanyId: string
): Promise<UserData[]> {
  try {
    const users = await prisma.user.findMany({
      where: { customerCompanyId, email: null },
      orderBy: { displayName: 'asc' }
    })
    return users.map(toUserData)
  } catch (error) {
    console.error('Error getting no-email users by company:', error)
    return []
  }
}

export async function updateUser(
  id: string,
  updates: Partial<
    Omit<UserData, 'id' | 'email' | 'passwordHash' | 'createdAt'>
  >
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
        }),
        ...(updates.lineManagerId !== undefined && {
          lineManagerId: updates.lineManagerId
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

function parsePermissions(raw: unknown): ProfilePermissions {
  const stored = (raw ?? {}) as Partial<ProfilePermissions>
  return {
    canEditDisplayName: stored.canEditDisplayName ?? true,
    canEditEmail: stored.canEditEmail ?? true,
    canEditJobRole: stored.canEditJobRole ?? true
  }
}

export async function getProfilePermissions(
  userId: string
): Promise<ProfilePermissions> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true }
    })
    return parsePermissions(user?.tenant?.profilePermissions)
  } catch {
    return { ...DEFAULT_PROFILE_PERMISSIONS }
  }
}

export async function getTenantProfilePermissions(
  tenantId: string
): Promise<ProfilePermissions> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    return parsePermissions(tenant?.profilePermissions)
  } catch {
    return { ...DEFAULT_PROFILE_PERMISSIONS }
  }
}

export async function updateProfilePermissions(
  tenantId: string,
  permissions: Partial<ProfilePermissions>
): Promise<boolean> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    const merged = parsePermissions({
      ...((tenant?.profilePermissions as Partial<ProfilePermissions>) ?? {}),
      ...permissions
    })
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        profilePermissions: merged as unknown as Prisma.InputJsonValue
      }
    })
    return true
  } catch {
    return false
  }
}

export async function updateUserProfile(
  userId: string,
  updates: {
    displayName?: string
    email?: string
    jobRole?: string | null
    currentPassword?: string
    newPassword?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { success: false, error: 'USER_NOT_FOUND' }

    const data: Record<string, unknown> = {}

    if (updates.newPassword) {
      if (!user.passwordHash || !updates.currentPassword) {
        return { success: false, error: 'WRONG_PASSWORD' }
      }
      const match = await bcrypt.compare(
        updates.currentPassword,
        user.passwordHash
      )
      if (!match) return { success: false, error: 'WRONG_PASSWORD' }
      data.passwordHash = await bcrypt.hash(updates.newPassword, 10)
    }

    if (updates.email !== undefined && updates.email !== user.email) {
      const taken = await prisma.user.findUnique({
        where: { email: updates.email }
      })
      if (taken) return { success: false, error: 'EMAIL_TAKEN' }
      if (user.email) {
        await prisma.passwordReset.deleteMany({ where: { email: user.email } })
      }
      data.email = updates.email
    }

    if (updates.displayName !== undefined)
      data.displayName = updates.displayName
    if (updates.jobRole !== undefined) data.jobRole = updates.jobRole

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data })
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating user profile:', error)
    return { success: false, error: 'DB_ERROR' }
  }
}

// Resolves a list of users to email recipients, routing no-email users to their
// line manager. Deduplicates by email so one manager only gets one notification
// even if they manage multiple no-email workers in the same batch.
export async function resolveEmailRecipients(
  users: UserData[]
): Promise<{ email: string; name: string }[]> {
  const emailUsers = users.filter((u) => u.email)
  const noEmailUsers = users.filter((u) => !u.email && u.lineManagerId)

  const managerIds = [...new Set(noEmailUsers.map((u) => u.lineManagerId!))]
  const managers = await Promise.all(managerIds.map((id) => getUserById(id)))
  const managerMap = new Map(managers.filter(Boolean).map((m) => [m!.id, m!]))

  const recipients: { email: string; name: string }[] = [
    ...emailUsers.map((u) => ({ email: u.email!, name: u.displayName })),
    ...(noEmailUsers
      .map((u) => {
        const manager = managerMap.get(u.lineManagerId!)
        return manager?.email
          ? { email: manager.email, name: manager.displayName }
          : null
      })
      .filter(Boolean) as { email: string; name: string }[])
  ]

  const seen = new Set<string>()
  return recipients.filter((r) => {
    if (seen.has(r.email)) return false
    seen.add(r.email)
    return true
  })
}
