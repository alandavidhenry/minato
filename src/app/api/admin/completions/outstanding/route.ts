// src/app/api/admin/completions/outstanding/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getOutstandingCompletions } from '@/lib/outstanding-completions'
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
    const rows = await getOutstandingCompletions()
    return NextResponse.json({ rows })
  } catch (error) {
    console.error('Error fetching outstanding completions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch outstanding completions' },
      { status: 500 }
    )
  }
}
