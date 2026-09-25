import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  DEFAULT_COMPLETION_RETENTION_YEARS,
  MAX_COMPLETION_RETENTION_YEARS,
  MIN_COMPLETION_RETENTION_YEARS
} from '@/lib/data-retention'
import {
  getAdminTenantId,
  getCompletionRetentionYears,
  updateCompletionRetentionYears
} from '@/lib/user-database'
import { ADMIN_ROLES, UserRole } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user?.roles ?? []) as UserRole[]
  if (!session?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getAdminTenantId(session.user.id)
  if (!tenantId)
    return Response.json({ error: 'No tenant found' }, { status: 404 })

  const retentionYears = await getCompletionRetentionYears(tenantId)
  return Response.json({
    retentionYears,
    min: MIN_COMPLETION_RETENTION_YEARS,
    max: MAX_COMPLETION_RETENTION_YEARS,
    default: DEFAULT_COMPLETION_RETENTION_YEARS
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = (session?.user?.roles ?? []) as UserRole[]
  if (!session?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const retentionYears = Number(body.retentionYears)

  if (
    !Number.isInteger(retentionYears) ||
    retentionYears < MIN_COMPLETION_RETENTION_YEARS ||
    retentionYears > MAX_COMPLETION_RETENTION_YEARS
  ) {
    return Response.json(
      {
        error: `retentionYears must be an integer between ${MIN_COMPLETION_RETENTION_YEARS} and ${MAX_COMPLETION_RETENTION_YEARS}.`
      },
      { status: 400 }
    )
  }

  const tenantId = await getAdminTenantId(session.user.id)
  if (!tenantId)
    return Response.json({ error: 'No tenant found' }, { status: 404 })

  const ok = await updateCompletionRetentionYears(tenantId, retentionYears)
  if (!ok) return Response.json({ error: 'Failed to save' }, { status: 500 })
  return Response.json({ success: true })
}
