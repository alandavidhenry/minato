import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  getTenantProfilePermissions,
  updateProfilePermissions
} from '@/lib/user-database'
import { ADMIN_ROLES, UserRole } from '@/types/rbac'

async function getAdminTenantId(adminUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { tenantId: true }
  })
  if (user?.tenantId) return user.tenantId
  const tenant = await prisma.tenant.findFirst({ select: { id: true } })
  return tenant?.id ?? null
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user?.roles ?? []) as UserRole[]
  if (!session?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getAdminTenantId(session.user.id)
  if (!tenantId)
    return Response.json({ error: 'No tenant found' }, { status: 404 })

  const permissions = await getTenantProfilePermissions(tenantId)
  return Response.json({ permissions })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = (session?.user?.roles ?? []) as UserRole[]
  if (!session?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getAdminTenantId(session.user.id)
  if (!tenantId)
    return Response.json({ error: 'No tenant found' }, { status: 404 })

  const body = await req.json()
  const { canEditDisplayName, canEditEmail, canEditJobRole } = body

  const ok = await updateProfilePermissions(tenantId, {
    ...(typeof canEditDisplayName === 'boolean' && { canEditDisplayName }),
    ...(typeof canEditEmail === 'boolean' && { canEditEmail }),
    ...(typeof canEditJobRole === 'boolean' && { canEditJobRole })
  })

  if (!ok) return Response.json({ error: 'Failed to save' }, { status: 500 })
  return Response.json({ success: true })
}
