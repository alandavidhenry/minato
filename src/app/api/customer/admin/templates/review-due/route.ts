import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getTemplatesDueForReview } from '@/lib/template-reviews'
import { UserRole } from '@/types/rbac'

// The company's own self-serve templates that are overdue or due for review
// soon — backs the summary card and the notification bell.
export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  try {
    const templates = await getTemplatesDueForReview(new Date(), companyId)
    return NextResponse.json({ count: templates.length, templates })
  } catch (error) {
    console.error('Error fetching templates due for review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates due for review' },
      { status: 500 }
    )
  }
}
