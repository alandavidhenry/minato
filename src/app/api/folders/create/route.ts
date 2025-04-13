// src/app/api/folders/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import { createEmptyFolder } from '@/lib/folder-manager'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { path } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      )
    }

    // Create the folder by adding a placeholder file
    const folderPath = await createEmptyFolder(path)

    // Log the activity
    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? 'Unknown user',
        fileName: folderPath,
        activityType: ActivityType.UPLOAD,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          undefined
      })
    }

    return NextResponse.json({
      message: 'Folder created successfully',
      folderPath
    })
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
