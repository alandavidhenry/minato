// src/app/api/admin/completions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  deleteCompletionRecord,
  getCompletionById
} from '@/lib/completion-records'
import { deleteBlob } from '@/lib/storage'
import { ADMIN_ROLES } from '@/types/rbac'

export async function DELETE(
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

    const existing = await getCompletionById(id)
    if (!existing) {
      return NextResponse.json(
        { error: 'Completion not found.' },
        { status: 404 }
      )
    }

    const success = await deleteCompletionRecord(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete completion.' },
        { status: 500 }
      )
    }

    // Best-effort: remove the PDF blob from storage if one exists
    if (existing.blobPath) {
      try {
        await deleteBlob(
          process.env.AZURE_STORAGE_CONTAINER_NAME!,
          existing.blobPath
        )
      } catch (err) {
        console.warn('Could not delete completion blob:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting completion:', error)
    return NextResponse.json(
      { error: 'Failed to delete completion.' },
      { status: 500 }
    )
  }
}
