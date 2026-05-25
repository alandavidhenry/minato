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

  // Enforce https and an exact server-controlled hostname allowlist to prevent SSRF.
  const allowedHost = process.env.AZURE_STORAGE_PROXY_HOST?.toLowerCase()
  if (!allowedHost) {
    console.error('AZURE_STORAGE_PROXY_HOST is not configured')
    return NextResponse.json({ error: 'Proxy host is not configured' }, { status: 500 })
  }

  const requestHost = parsedUrl.hostname.toLowerCase()
  const validHost = requestHost === allowedHost

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
    // Reconstruct URL with a server-controlled origin to avoid SSRF via user input.
    // Never use user input for protocol/host.
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

    const response = await fetch(safeUrl.toString())

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
