// src/app/api/admin/completions/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getCompletionById } from '@/lib/completion-records'
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
    const completion = await getCompletionById(id)

    if (!completion) {
      return NextResponse.json(
        { error: 'Completion not found.' },
        { status: 404 }
      )
    }

    if (!completion.blobPath) {
      return NextResponse.json(
        { error: 'PDF not available for this completion.' },
        { status: 404 }
      )
    }

    const url = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      completion.blobPath,
      {
        permissions: 'r',
        contentDisposition: `attachment; filename="completion-${id}.pdf"`
      }
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating completion download URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate download link' },
      { status: 500 }
    )
  }
}
