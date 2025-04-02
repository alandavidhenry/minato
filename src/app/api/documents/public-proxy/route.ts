// src/app/api/documents/public-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Validate that the URL is from our Azure storage (basic security check)
    const urlObj = new URL(url)

    // Check if the URL is from our Azure blob storage
    if (!urlObj.hostname.includes('.blob.core.windows.net')) {
      return NextResponse.json({ error: 'Invalid URL domain' }, { status: 400 })
    }

    // Check if the URL has a SAS token
    if (!urlObj.search.includes('sv=') || !urlObj.search.includes('sig=')) {
      return NextResponse.json(
        { error: 'URL does not contain a valid SAS token' },
        { status: 400 }
      )
    }

    // Fetch the document from Azure Storage
    const response = await fetch(url)

    if (!response.ok) {
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
    console.error('Public proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy document' },
      { status: 500 }
    )
  }
}
