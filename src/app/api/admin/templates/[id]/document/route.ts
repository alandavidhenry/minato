// src/app/api/admin/templates/[id]/document/route.ts
// Returns a time-limited SAS URL for viewing an upload-based template's
// source document, for the admin "Preview" tab (view-template-dialog.tsx).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { generateSasToken } from '@/lib/storage'
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
    const template = await getDocumentTemplateById(id)

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.sourceType !== 'upload' || !template.sourceDocBlobPath) {
      return NextResponse.json(
        { error: 'No document is available for this template.' },
        { status: 404 }
      )
    }

    const url = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      template.sourceDocBlobPath,
      {
        permissions: 'r',
        contentDisposition: `inline; filename="${template.sourceDocFileName ?? 'document.pdf'}"`
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
