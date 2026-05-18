// src/app/api/customer/assignments/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentsForUser } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const userId = session?.user?.id
  const customerCompanyId = session?.user?.customerCompanyId

  if (!customerCompanyId || !userId) {
    return NextResponse.json(
      { error: 'No company associated with this account.' },
      { status: 403 }
    )
  }

  try {
    const assignments = await getAssignmentsForUser(userId, customerCompanyId)
    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}
