// src/app/api/documents/delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFileManager } from '@/lib/file-manager'

interface DeleteRequestBody {
  items?: Array<{
    name: string
    isFolder?: boolean
    path?: string
  }>
  names?: string[]
}

interface DeleteResult {
  name: string
  path?: string
  isFolder: boolean
  success: boolean
  deletedCount?: number
  message: string
}

export async function DELETE(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get file manager instance
    const fileManager = getFileManager()

    // Parse request
    const requestBody = (await request
      .json()
      .catch(() => ({}) as DeleteRequestBody)) as DeleteRequestBody

    // Handle items deletion (files or folders)
    if (requestBody.items && Array.isArray(requestBody.items)) {
      const results: DeleteResult[] = []

      for (const item of requestBody.items) {
        const itemPath = item.path ?? item.name

        if (item.isFolder) {
          const result = await fileManager.deleteFolder(
            itemPath,
            session.user?.id ?? 'unknown',
            session.user?.name ?? 'Unknown User'
          )

          results.push({
            name: item.name,
            path: itemPath,
            isFolder: true,
            success: result.success,
            deletedCount: result.data?.deletedCount ?? 0,
            message: result.message
          })
        } else {
          // For files, use the file manager
          const result = await fileManager.deleteFile(
            item.name,
            session.user?.id ?? 'unknown',
            session.user?.name ?? 'Unknown User'
          )

          results.push({
            name: item.name,
            isFolder: false,
            success: result.success,
            message: result.message
          })
        }
      }

      return NextResponse.json({ results })
    }

    // Handle legacy names array
    if (requestBody.names && Array.isArray(requestBody.names)) {
      const results: DeleteResult[] = []

      for (const name of requestBody.names) {
        // For legacy support, we need to determine if it's a file or folder
        const isFolder = name.includes('/') && !name.includes('.')

        if (isFolder) {
          const result = await fileManager.deleteFolder(
            name,
            session.user?.id ?? 'unknown',
            session.user?.name ?? 'Unknown User'
          )

          results.push({
            name,
            path: name,
            isFolder: true,
            success: result.success,
            deletedCount: result.data?.deletedCount ?? 0,
            message: result.message
          })
        } else {
          const result = await fileManager.deleteFile(
            name,
            session.user?.id ?? 'unknown',
            session.user?.name ?? 'Unknown User'
          )

          results.push({
            name,
            isFolder: false,
            success: result.success,
            message: result.message
          })
        }
      }

      return NextResponse.json({ results })
    }

    // For single file deletion via query parameter (legacy support)
    const name = request.nextUrl.searchParams.get('name')
    if (name) {
      // Check if it's a folder (crude heuristic)
      const isFolder = name.includes('/') && !name.includes('.')

      if (isFolder) {
        const result = await fileManager.deleteFolder(
          name,
          session.user?.id ?? 'unknown',
          session.user?.name ?? 'Unknown User'
        )

        return NextResponse.json({
          name,
          isFolder: true,
          success: result.success,
          deletedCount: result.data?.deletedCount ?? 0,
          message: result.message
        })
      } else {
        const result = await fileManager.deleteFile(
          name,
          session.user?.id ?? 'unknown',
          session.user?.name ?? 'Unknown User'
        )

        return NextResponse.json({
          name,
          isFolder: false,
          success: result.success,
          message: result.message
        })
      }
    }

    return NextResponse.json(
      { error: 'Invalid request, no items to delete specified' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Delete operation failed'
      },
      { status: 500 }
    )
  }
}
