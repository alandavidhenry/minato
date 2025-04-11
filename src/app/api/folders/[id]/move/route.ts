// src/app/api/folders/[id]/move/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { moveOrCopyFolder } from '@/lib/folder-manager'

// POST: Move or copy a folder
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const folderId = params.id
    const { targetPath, operation } = await request.json()

    // Validate operation
    if (operation !== 'move' && operation !== 'copy') {
      return NextResponse.json(
        { error: 'Invalid operation, must be "move" or "copy"' },
        { status: 400 }
      )
    }

    // Move or copy the folder
    const result = await moveOrCopyFolder(folderId, targetPath || '', operation)

    if (!result) {
      return NextResponse.json(
        { error: `Failed to ${operation} folder` },
        { status: 500 }
      )
    }

    return NextResponse.json({ folder: result })
  } catch (error) {
    console.error('Error moving/copying folder:', error)
    return NextResponse.json(
      { error: 'Failed to move/copy folder' },
      { status: 500 }
    )
  }
}
