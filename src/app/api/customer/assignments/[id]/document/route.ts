// src/app/api/customer/assignments/[id]/document/route.ts
// Returns a time-limited SAS URL for viewing/downloading an upload-based
// template's source document (P19). Used by the read-only and
// fill-and-return flows alike — both start with the assignee reading the
// shared source document before signing.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentWithTemplate } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { generateSasToken } from '@/lib/storage'
import { CUSTOMER_ROLES } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const customerCompanyId = session?.user?.customerCompanyId
  if (!customerCompanyId) {
    return NextResponse.json(
      { error: 'No company associated with this account.' },
      { status: 403 }
    )
  }

  try {
    const { id: assignmentId } = await params
    const assignment = await getAssignmentWithTemplate(assignmentId)

    if (!assignment || assignment.customerCompanyId !== customerCompanyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    if (
      assignment.template.sourceType !== 'upload' ||
      !assignment.template.sourceDocBlobPath
    ) {
      return NextResponse.json(
        { error: 'No document is available for this assignment.' },
        { status: 404 }
      )
    }

    const url = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      assignment.template.sourceDocBlobPath,
      {
        permissions: 'r',
        contentDisposition: `inline; filename="${assignment.template.sourceDocFileName ?? 'document.pdf'}"`
      }
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating document view URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate document view URL.' },
      { status: 500 }
    )
  }
}
