// src/app/api/customer/assignments/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentById } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { getFileManager } from '@/lib/file-system'
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

    // Verify the assignment belongs to this company
    const assignment = await getAssignmentById(assignmentId)

    if (!assignment || assignment.customerCompanyId !== customerCompanyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    // Check the template has a file
    const template = await getDocumentTemplateById(assignment.templateId)

    if (!template?.blobPath) {
      return NextResponse.json(
        { error: 'No file is available for this document.' },
        { status: 404 }
      )
    }

    // Generate a time-limited SAS download URL
    const fileManager = getFileManager()
    const url = await fileManager.generateDownloadUrl(template.blobPath)

    if (!url) {
      return NextResponse.json(
        { error: 'Failed to generate download URL.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating download URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate download URL.' },
      { status: 500 }
    )
  }
}
