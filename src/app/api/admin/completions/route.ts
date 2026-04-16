// src/app/api/admin/completions/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getAllCompletionsForAdmin } from '@/lib/completion-records'
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
    const completions = await getAllCompletionsForAdmin()
    return NextResponse.json({ completions })
  } catch (error) {
    console.error('Error fetching completions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completions' },
      { status: 500 }
    )
  }
}
