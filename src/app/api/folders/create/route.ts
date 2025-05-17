// src/app/api/folders/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFileManager } from '@/lib/file-manager'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse request body
    const body = await request.json()
    const { name, path } = body

    // Log the request for debugging
    console.log('Create folder request:', { name, path })

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Get the file manager instance
    const fileManager = getFileManager()

    // Construct full folder path
    const folderPath = path ? `${path}/${name.trim()}` : name.trim()

    // Create the folder
    const result = await fileManager.createFolder(
      folderPath,
      session.user?.id ?? 'unknown',
      session.user?.name ?? 'Unknown User'
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        folder: {
          name: name.trim(),
          path: folderPath
        }
      })
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }
  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create folder'
      },
      { status: 500 }
    )
  }
}
