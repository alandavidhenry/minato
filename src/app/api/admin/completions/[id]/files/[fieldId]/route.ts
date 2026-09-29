// src/app/api/admin/completions/[id]/files/[fieldId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionById } from '@/lib/completion-records'
import { generateSasToken } from '@/lib/storage'
import type { UploadedFileValue } from '@/types/form-schema'
import { ADMIN_ROLES } from '@/types/rbac'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
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
    const { id, fieldId } = await params
    const completion = await getCompletionById(id)

    if (!completion) {
      return NextResponse.json(
        { error: 'Completion not found.' },
        { status: 404 }
      )
    }

    const formData =
      completion.formData && typeof completion.formData === 'object'
        ? (completion.formData as Record<string, unknown>)
        : {}
    const value = formData[fieldId] as Partial<UploadedFileValue> | undefined

    if (
      !value ||
      typeof value.blobPath !== 'string' ||
      typeof value.fileName !== 'string'
    ) {
      return NextResponse.json(
        { error: 'File not found for this field.' },
        { status: 404 }
      )
    }

    const url = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      value.blobPath,
      {
        permissions: 'r',
        contentDisposition: `attachment; filename="${value.fileName}"`
      }
    )

    return NextResponse.json({ url, fileName: value.fileName })
  } catch (error) {
    console.error('Error generating uploaded file download URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate download link' },
      { status: 500 }
    )
  }
}
