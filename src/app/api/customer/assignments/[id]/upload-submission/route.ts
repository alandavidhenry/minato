// src/app/api/customer/assignments/[id]/upload-submission/route.ts
// Uploads the employee's own filled-in copy of a 'fill-and-return'
// upload-based template (P19 Phase 5). Word documents are converted to PDF
// (retaining the original); PDFs are stored as-is — mirrors the template
// authoring upload routes. Returns blob paths to be submitted with the rest
// of the completion on POST /complete; the CompletionRecord isn't created
// until then, so nothing is persisted to the database here.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentWithTemplate } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { uploadSourceDocument } from '@/lib/document-upload'
import { generateVersionId } from '@/lib/version-manager'
import { CUSTOMER_ROLES } from '@/types/rbac'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
    const assignment = await getAssignmentWithTemplate(assignmentId)

    if (!assignment || assignment.customerCompanyId !== customerCompanyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    if (
      assignment.template.sourceType !== 'upload' ||
      assignment.template.uploadMode !== 'fill-and-return'
    ) {
      return NextResponse.json(
        { error: 'This document does not accept an uploaded submission.' },
        { status: 400 }
      )
    }

    const body = await request.formData()
    const file = body.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Missing required field: file' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds the 10MB upload limit.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await uploadSourceDocument({
      buffer,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      pathPrefix: `assignment-submissions/${assignmentId}/${userId}-${generateVersionId()}`
    })

    return NextResponse.json(result)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Unsupported file type')
    ) {
      return NextResponse.json(
        { error: 'Only Word (.doc, .docx) and PDF files are supported.' },
        { status: 400 }
      )
    }
    console.error('Error uploading assignment submission document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
