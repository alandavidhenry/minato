// src/app/api/admin/companies/[id]/user-assignments/route.ts
// Returns all individual (user-level) assignments for a given company,
// i.e. assignments where userId IS NOT NULL and customerCompanyId matches.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentsForUserOnly } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { getUsersByCompany } from '@/lib/user-database'
import { ADMIN_ROLES } from '@/types/rbac'

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id: customerCompanyId } = await params
    const users = await getUsersByCompany(customerCompanyId)

    const userAssignments = await Promise.all(
      users.map(async (user) => ({
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role
        },
        assignments: await getAssignmentsForUserOnly(user.id)
      }))
    )

    return NextResponse.json({ userAssignments })
  } catch (error) {
    console.error('Error fetching user assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user assignments' },
      { status: 500 }
    )
  }
}
