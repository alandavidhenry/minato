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

  // Validate the URL against an allow-listed Azure Storage host to prevent SSRF
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
  }

  const allowedHost = process.env.AZURE_STORAGE_PROXY_HOST?.toLowerCase()
  if (!allowedHost) {
    return NextResponse.json(
      { error: 'Document proxy is not configured' },
      { status: 500 }
    )
  }

  const validHost = parsedUrl.hostname.toLowerCase() === allowedHost

  if (parsedUrl.protocol !== 'https:' || !validHost) {
    return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
  }

  try {
    // Build the URL from server-controlled components only, severing CodeQL's SSRF taint chain.
    // Host comes from the env var (never from user input); pathname is validated for traversal.
    const normalizedPath = parsedUrl.pathname
    const lowerPath = normalizedPath.toLowerCase()
    if (
      lowerPath.includes('/../') ||
      lowerPath.endsWith('/..') ||
      lowerPath.includes('%2e%2e') ||
      lowerPath.includes('%2e.')
    ) {
      return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
    }

    const safeUrl = new URL(`https://${allowedHost}`)
    safeUrl.pathname = normalizedPath
    for (const [key, value] of parsedUrl.searchParams) {
      safeUrl.searchParams.set(key, value)
    }
    const response = await fetch(safeUrl)

    if (!response.ok) {
      // Log the view activity
      if (session?.user) {
        await logActivity({
          userId: session.user.id,
          userName: session.user.name ?? session.user.email ?? 'Unknown user',
          fileName: parsedUrl.pathname.split('/').pop() ?? 'Unknown file',
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
