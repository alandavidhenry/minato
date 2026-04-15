// src/app/api/customer/assignments/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentById } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { createCompletionRecord } from '@/lib/completion-records'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const customerCompanyId = session?.user?.customerCompanyId
  const userId = session?.user?.id

  if (!customerCompanyId || !userId) {
    return NextResponse.json(
      { error: 'No company associated with this account.' },
      { status: 403 }
    )
  }

  try {
    const { id: assignmentId } = await params

    const assignment = await getAssignmentById(assignmentId)

    if (!assignment || assignment.customerCompanyId !== customerCompanyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))

    const record = await createCompletionRecord({
      assignmentId,
      signedById: userId,
      formData: body.formData
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Failed to record completion' },
        { status: 500 }
      )
    }

    return NextResponse.json({ completion: record })
  } catch (error) {
    console.error('Error recording completion:', error)
    return NextResponse.json(
      { error: 'Failed to record completion' },
      { status: 500 }
    )
  }
}
