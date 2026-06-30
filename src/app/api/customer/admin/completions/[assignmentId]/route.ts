import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getAssignmentStatusSummary } from '@/lib/completion-records'
import prisma from '@/lib/prisma'
import { UserRole } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const companyId = session?.user?.customerCompanyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
  }

  try {
    const { assignmentId } = await params

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { customerCompanyId: true }
    })

    if (!assignment || assignment.customerCompanyId !== companyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    const raw = await getAssignmentStatusSummary(assignmentId)
    if (!raw) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    // Replace blobPath with hasPdf — don't expose internal storage paths
    const safeRecords = raw.completedRecords.map((r) => ({
      id: r.id,
      signedAt: r.signedAt,
      hasPdf: r.blobPath !== null,
      signer: r.signer
    }))

    return NextResponse.json({
      summary: {
        templateTitle: raw.templateTitle,
        dueDate: raw.dueDate,
        isOverdue: raw.isOverdue,
        completedRecords: safeRecords,
        outstandingUsers: raw.outstandingUsers
      }
    })
  } catch (error) {
    console.error('Error fetching assignment status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignment status.' },
      { status: 500 }
    )
  }
}
