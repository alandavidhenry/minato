import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getRecentCompletionsForAdmin } from '@/lib/completion-records'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const rawLimit = parseInt(req.nextUrl.searchParams.get('limit') ?? '5', 10)
  const limit = Math.min(isNaN(rawLimit) ? 5 : rawLimit, 20)

  try {
    const completions = await getRecentCompletionsForAdmin(limit)
    return NextResponse.json({ completions })
  } catch (error) {
    console.error('Error fetching recent completions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent completions' },
      { status: 500 }
    )
  }
}
