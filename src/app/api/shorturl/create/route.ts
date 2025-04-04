// src/app/api/shorturl/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { createShortUrl } from '@/lib/url-shortener'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await request.json()
    const { url, expirationDays } = data

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Default to 7 days if not specified
    const expiration = expirationDays || 7

    // Create short URL
    const shortCode = await createShortUrl(url, expiration)

    // Generate full shortened URL
    const host = request.headers.get('host') ?? 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const shortUrl = `${protocol}://${host}/s/${shortCode}`

    return NextResponse.json({ shortUrl, originalUrl: url })
  } catch (error) {
    console.error('Error creating short URL:', error)
    return NextResponse.json(
      { error: 'Failed to create short URL' },
      { status: 500 }
    )
  }
}
