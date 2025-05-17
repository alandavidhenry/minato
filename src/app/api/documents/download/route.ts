// src/app/api/documents/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import { getFileManager } from '@/lib/file-manager'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const name = request.nextUrl.searchParams.get('name')
    if (!name) {
      return NextResponse.json(
        { error: 'Document name is required' },
        { status: 400 }
      )
    }

    // Use file manager to generate download URL
    const fileManager = getFileManager()
    const url = await fileManager.generateDownloadUrl(name)

    if (!url) {
      return NextResponse.json(
        { error: 'Failed to generate download URL. File may not exist.' },
        { status: 404 }
      )
    }

    // Log the activity
    await logActivity({
      userId: session.user?.id ?? 'unknown',
      userName: session.user?.name ?? 'Unknown User',
      fileName: name,
      activityType: ActivityType.DOWNLOAD,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Download failed'
      },
      { status: 500 }
    )
  }
}
