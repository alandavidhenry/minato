// src/app/api/admin/assignments/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAllAssignmentsForAdmin } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const assignments = await getAllAssignmentsForAdmin()
    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching all assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}
