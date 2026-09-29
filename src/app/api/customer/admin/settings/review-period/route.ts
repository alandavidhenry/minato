import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { isValidReviewPeriod } from '@/lib/review-dates'
import {
  getCompanyReviewPeriodMonths,
  getReviewPeriodMonthsForCompany,
  updateCompanyReviewPeriodMonths
} from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

async function getCompanyId() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return {
      response: NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }
  }
  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return {
      response: NextResponse.json(
        { error: 'No company assigned.' },
        { status: 403 }
      )
    }
  }
  return { companyId }
}

// The company's own default review period for its self-serve templates.
// `reviewPeriodMonths` is the company's override (null = inherits the
// organisation default); `effective` is what a new template would get.
export async function GET() {
  const { companyId, response } = await getCompanyId()
  if (response) return response

  const [reviewPeriodMonths, effective] = await Promise.all([
    getCompanyReviewPeriodMonths(companyId),
    getReviewPeriodMonthsForCompany(companyId)
  ])
  return NextResponse.json({ reviewPeriodMonths, effective })
}

// Body: { reviewPeriodMonths: number | null } — null clears the override.
// Existing templates keep their own period.
export async function PATCH(request: NextRequest) {
  const { companyId, response } = await getCompanyId()
  if (response) return response

  const body = await request.json()
  const value = body.reviewPeriodMonths

  if (value !== null && !isValidReviewPeriod(value)) {
    return NextResponse.json(
      {
        error:
          'reviewPeriodMonths must be null or a whole number of months, 1-120'
      },
      { status: 400 }
    )
  }

  const ok = await updateCompanyReviewPeriodMonths(companyId, value)
  if (!ok) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
