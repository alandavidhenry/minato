// src/app/api/customer/admin/templates/upload-document/route.ts
// Company-scoped equivalent of /api/admin/templates/upload-document, for the
// self-serve portal (P17/P19). Auth-only at upload time — ownership of the
// resulting blob paths is enforced when the template record itself is
// created/updated, same as the main admin route.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { uploadSourceDocument } from '@/lib/document-upload'
import { generateVersionId } from '@/lib/version-manager'
import { UserRole } from '@/types/rbac'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.includes(UserRole.CUSTOMER_ADMIN)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  if (!session?.user?.customerCompanyId) {
    return NextResponse.json({ error: 'No company assigned.' }, { status: 403 })
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
    console.error('Error uploading company template source document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
