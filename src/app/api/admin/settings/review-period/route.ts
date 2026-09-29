import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  DEFAULT_REVIEW_MONTHS,
  isValidReviewPeriod,
  MAX_REVIEW_MONTHS,
  MIN_REVIEW_MONTHS
} from '@/lib/review-dates'
import {
  getAdminTenantId,
  getReviewPeriodMonths,
  updateReviewPeriodMonths
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

  return Response.json({
    reviewPeriodMonths: await getReviewPeriodMonths(tenantId),
    min: MIN_REVIEW_MONTHS,
    max: MAX_REVIEW_MONTHS,
    default: DEFAULT_REVIEW_MONTHS
  })
}

// Default review period for newly created templates. Existing templates keep
// their own period.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = (session?.user?.roles ?? []) as UserRole[]
  if (!session?.user?.id || !roles.some((r) => ADMIN_ROLES.includes(r))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const reviewPeriodMonths = Number(body.reviewPeriodMonths)

  if (!isValidReviewPeriod(reviewPeriodMonths)) {
    return Response.json(
      {
        error: `reviewPeriodMonths must be an integer between ${MIN_REVIEW_MONTHS} and ${MAX_REVIEW_MONTHS}.`
      },
      { status: 400 }
    )
  }

  const tenantId = await getAdminTenantId(session.user.id)
  if (!tenantId)
    return Response.json({ error: 'No tenant found' }, { status: 404 })

  const ok = await updateReviewPeriodMonths(tenantId, reviewPeriodMonths)
  if (!ok) return Response.json({ error: 'Failed to save' }, { status: 500 })
  return Response.json({ success: true })
}
