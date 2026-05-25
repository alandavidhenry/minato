// src/app/api/documents/public-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Validate URL syntax before entering the try block
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
  }

  // Enforce https and an exact Azure Blob Storage hostname suffix to prevent SSRF.
  // .includes() alone can be bypassed (e.g. evil.com?.blob.core.windows.net).
  const allowedHost = process.env.AZURE_STORAGE_PROXY_HOST
  const validHost = allowedHost
    ? parsedUrl.hostname === allowedHost
    : parsedUrl.hostname.endsWith('.blob.core.windows.net')

  if (parsedUrl.protocol !== 'https:' || !validHost) {
    return NextResponse.json({ error: 'Invalid document URL' }, { status: 400 })
  }

  // Check if the URL has a SAS token
  if (!parsedUrl.searchParams.has('sv') || !parsedUrl.searchParams.has('sig')) {
    return NextResponse.json(
      { error: 'URL does not contain a valid SAS token' },
      { status: 400 }
    )
  }

  try {
    // Reconstruct the URL from validated components to sever the SSRF taint chain.
    // Never pass parsedUrl.toString() (user input) directly to fetch.
    const safeUrl = new URL(`https://${parsedUrl.hostname}${parsedUrl.pathname}`)
    for (const [key, value] of parsedUrl.searchParams) {
      safeUrl.searchParams.set(key, value)
    }
    const response = await fetch(safeUrl)

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
