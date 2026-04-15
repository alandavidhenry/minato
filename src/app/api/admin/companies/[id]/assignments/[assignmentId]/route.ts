// src/app/api/admin/companies/[id]/assignments/[assignmentId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { deleteAssignment, getAssignmentById } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { ADMIN_ROLES } from '@/types/rbac'

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
    const { assignmentId } = await params

    const existing = await getAssignmentById(assignmentId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    const success = await deleteAssignment(assignmentId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete assignment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting assignment:', error)
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    )
  }
}
