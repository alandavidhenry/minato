// src/app/api/admin/companies/[id]/completions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionGroupsByCompany } from '@/lib/completion-records'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { id } = await params
    const groups = await getCompletionGroupsByCompany(id)
    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error fetching completion groups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch completion groups' },
      { status: 500 }
    )
  }
}
