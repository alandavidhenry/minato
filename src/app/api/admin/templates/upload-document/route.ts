// src/app/api/admin/templates/upload-document/route.ts
// Uploads a source document (Word or PDF) for an upload-based template
// (P19). Word documents are converted to PDF (retaining the original);
// PDFs are stored as-is. Returns the blob paths to be saved on the
// DocumentTemplate via the create/update/publish-version routes.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { uploadSourceDocument } from '@/lib/document-upload'
import { generateVersionId } from '@/lib/version-manager'
import { ADMIN_ROLES } from '@/types/rbac'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

async function checkAdminPermission() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export async function POST(request: NextRequest) {
  if (!(await checkAdminPermission())) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    )
  }

  try {
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
      pathPrefix: `template-uploads/${generateVersionId()}`
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
    console.error('Error uploading template source document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
