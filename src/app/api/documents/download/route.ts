// src/app/api/documents/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import { generateSasToken } from '@/lib/storage'

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  try {
    const sasUrl = await generateSasToken(
      process.env.AZURE_STORAGE_CONTAINER_NAME!,
      name,
      {
        permissions: 'r',
        startsOn: new Date(Date.now() - 60 * 1000), // Start 1 minute ago
        expiresOn: new Date(Date.now() + 30 * 60 * 1000), // Expire in 30 minutes
        contentDisposition: `inline; filename="${name}"` // Changed to inline for viewing
      }
    )

    // Log the download activity
    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? 'Unknown user',
        fileName: name,
        activityType: ActivityType.DOWNLOAD,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          undefined
      })
    }

    return NextResponse.json(
      { url: sasUrl },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    )
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    )
  }
}
