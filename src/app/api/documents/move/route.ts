// src/app/api/documents/move/route.ts
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
    const { sourcePath, targetPath, isFolder } = body

    if (!sourcePath || targetPath === undefined) {
      return NextResponse.json(
        { error: 'Source and target paths are required' },
        { status: 400 }
      )
    }

    // Get the file manager instance
    const fileManager = getFileManager()

    // Move the file or folder
    let result
    if (isFolder) {
      result = await fileManager.moveFolder(
        sourcePath,
        targetPath,
        session.user?.id ?? 'unknown',
        session.user?.name ?? 'Unknown User'
      )
    } else {
      result = await fileManager.moveFile(
        sourcePath,
        targetPath,
        session.user?.id ?? 'unknown',
        session.user?.name ?? 'Unknown User'
      )
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        sourcePath,
        targetPath,
        data: result.data
      })
    } else {
      console.error(`Move error: ${result.message}`)
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (error) {
    console.error('Error moving item:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to move item'
      },
      { status: 500 }
    )
  }
}
