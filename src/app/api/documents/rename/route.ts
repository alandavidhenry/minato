import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import { renameItem } from '@/lib/folder-manager'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const requestBody = await request.json()
    const { oldPath, newName, isFolder } = requestBody

    console.log('Received rename request:', { oldPath, newName, isFolder })

    if (!oldPath || !newName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Use the renameItem function
    const result = await renameItem(oldPath, newName, isFolder)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to rename item' },
        { status: 500 }
      )
    }

    // Log the activity
    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? 'Unknown user',
        fileName: result,
        activityType: ActivityType.RENAME,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          undefined
      })
    }

    return NextResponse.json({
      message: `${isFolder ? 'Folder' : 'File'} renamed successfully`,
      newPath: result
    })
  } catch (error) {
    console.error('Rename error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Rename operation failed'
      },
      { status: 500 }
    )
  }
}
