import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { enrollUserInMatchingAssignments } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  DEFAULT_PROFILE_PERMISSIONS,
  getProfilePermissions,
  getUserById,
  updateUserProfile
} from '@/lib/user-database'
import { CUSTOMER_ROLES, UserRole } from '@/types/rbac'

function isCustomerRole(roles: UserRole[]): boolean {
  return roles.some((r) => CUSTOMER_ROLES.includes(r))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserById(session.user.id)
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const roles = session.user.roles as UserRole[]
  const permissions = isCustomerRole(roles)
    ? await getProfilePermissions(session.user.id)
    : { ...DEFAULT_PROFILE_PERMISSIONS }

  let companyName: string | null = null
  if (user.customerCompanyId) {
    const company = await prisma.customerCompany.findUnique({
      where: { id: user.customerCompanyId },
      select: { name: true }
    })
    companyName = company?.name ?? null
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      jobRole: user.jobRole,
      lineManagerId: user.lineManagerId,
      createdAt: user.createdAt,
      customerCompanyId: user.customerCompanyId,
      companyName,
      hasPassword: !!user.passwordHash
    },
    permissions
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { displayName, email, jobRole, currentPassword, newPassword } = body

  const roles = session.user.roles as UserRole[]
  const permissions = isCustomerRole(roles)
    ? await getProfilePermissions(session.user.id)
    : { ...DEFAULT_PROFILE_PERMISSIONS }

  const updates: Parameters<typeof updateUserProfile>[1] = {}

  if (displayName !== undefined && permissions.canEditDisplayName) {
    const trimmed = String(displayName).trim()
    if (!trimmed)
      return Response.json({ error: 'INVALID_NAME' }, { status: 400 })
    updates.displayName = trimmed
  }

  if (email !== undefined && permissions.canEditEmail) {
    const trimmed = String(email).trim().toLowerCase()
    const atIdx = trimmed.indexOf('@')
    const validEmail =
      trimmed.length <= 254 &&
      atIdx > 0 &&
      atIdx === trimmed.lastIndexOf('@') &&
      trimmed.lastIndexOf('.') > atIdx + 1 &&
      !trimmed.includes(' ')
    if (!validEmail) {
      return Response.json({ error: 'INVALID_EMAIL' }, { status: 400 })
    }
    updates.email = trimmed
  }

  if (jobRole !== undefined && permissions.canEditJobRole) {
    updates.jobRole = jobRole ? String(jobRole).trim() || null : null
  }

  if (newPassword !== undefined) {
    if (String(newPassword).length < 6) {
      return Response.json({ error: 'PASSWORD_TOO_SHORT' }, { status: 400 })
    }
    updates.currentPassword = currentPassword
    updates.newPassword = String(newPassword)
  }

  const result = await updateUserProfile(session.user.id, updates)
  if (!result.success) {
    const status =
      result.error === 'EMAIL_TAKEN'
        ? 409
        : result.error === 'WRONG_PASSWORD'
          ? 400
          : 500
    return Response.json({ error: result.error }, { status })
  }

  if ('jobRole' in updates) {
    const updatedUser = await getUserById(session.user.id)
    if (updatedUser?.customerCompanyId) {
      await enrollUserInMatchingAssignments(
        session.user.id,
        updatedUser.customerCompanyId,
        updatedUser.jobRole
      )
    }
  }

  return Response.json({ success: true })
}
