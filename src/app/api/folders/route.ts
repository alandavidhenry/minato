// src/app/api/folders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { listBlobs } from '@/lib/list-blobs'

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const path = request.nextUrl.searchParams.get('path') ?? ''

    // List blobs in the specified path
    const contents = await listBlobs(false, path)

    return NextResponse.json({ contents })
  } catch (error) {
    console.error('Error listing folder contents:', error)
    return NextResponse.json(
      { error: 'Failed to list folder contents' },
      { status: 500 }
    )
  }
}
