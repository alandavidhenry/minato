import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionGroupsByCompany } from '@/lib/completion-records'
import { UserRole } from '@/types/rbac'

export async function GET(_request: NextRequest) {
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
    const groups = await getCompletionGroupsByCompany(companyId)
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error fetching team completion groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion groups.' },
      { status: 500 }
    )
  }
}
