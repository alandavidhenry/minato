// src/app/api/customer/completions/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionsForUser } from '@/lib/completion-records'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  try {
    const completions = await getCompletionsForUser(userId)
    return NextResponse.json({ completions })
  } catch (error) {
    console.error('Error fetching completions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completions' },
      { status: 500 }
    )
  }
}
