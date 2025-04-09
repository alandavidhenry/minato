// src/app/api/documents/proxy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Fetch the document from Azure Storage
    const response = await fetch(url)

    if (!response.ok) {
      // Log the view activity
      if (session?.user) {
        await logActivity({
          userId: session.user.id,
          userName: session.user.name ?? session.user.email ?? 'Unknown user',
          fileName: new URL(url).pathname.split('/').pop() ?? 'Unknown file',
          activityType: ActivityType.VIEW,
          ipAddress:
            request.headers.get('x-forwarded-for') ??
            request.headers.get('x-real-ip') ??
            undefined
        })
      }
      return NextResponse.json(
        { error: `Failed to fetch document: ${response.statusText}` },
        { status: response.status }
      )
    }

    // Get the response as an array buffer
    const data = await response.arrayBuffer()

    // Determine content type
    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream'

    // Create a new response with the data
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy document' },
      { status: 500 }
    )
  }
}
