import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getUsersByCompany } from '@/lib/user-database'
import { UserRole } from '@/types/rbac'

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
    const users = await getUsersByCompany(companyId)
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        jobRole: u.jobRole
      }))
    })
  } catch (error) {
    console.error('Error fetching company users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
