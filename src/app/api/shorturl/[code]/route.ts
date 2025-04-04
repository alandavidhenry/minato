// src/app/api/shorturl/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { resolveShortUrl } from '@/lib/url-shortener'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code

  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  try {
    const originalUrl = await resolveShortUrl(code)

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'URL not found or expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({ url: originalUrl })
  } catch (error) {
    console.error('Error resolving short URL:', error)
    return NextResponse.json(
      { error: 'Failed to resolve short URL' },
      { status: 500 }
    )
  }
}
