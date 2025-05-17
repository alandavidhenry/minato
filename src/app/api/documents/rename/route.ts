// src/app/api/documents/rename/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFileManager } from '@/lib/file-system'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse request body
    const body = await request.json()
    const { path, newName, isFolder } = body

    if (!path || !newName) {
      return NextResponse.json(
        { error: 'Path and new name are required' },
        { status: 400 }
      )
    }

    // Get the file manager instance
    const fileManager = getFileManager()

    // Rename the file or folder
    let result
    if (isFolder) {
      result = await fileManager.renameFolder(
        path,
        newName,
        session.user?.id ?? 'unknown',
        session.user?.name ?? 'Unknown User'
      )
    } else {
      result = await fileManager.renameFile(
        path,
        newName,
        session.user?.id ?? 'unknown',
        session.user?.name ?? 'Unknown User'
      )
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        oldPath: path,
        newPath: result.data?.newPath
      })
    } else {
      console.error(`Rename error: ${result.message}`)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (error) {
    console.error('Error renaming item:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to rename item'
      },
      { status: 500 }
    )
  }
}
