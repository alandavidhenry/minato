// src/app/api/folders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFileManager } from '@/lib/file-manager'

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const path = request.nextUrl.searchParams.get('path') ?? ''

    // Use the file manager to list contents
    const fileManager = getFileManager()
    const contents = await fileManager.listContent(path)

    return NextResponse.json({
      success: true,
      path,
      contents
    })
  } catch (error) {
    console.error('Error listing folder contents:', error)
    return NextResponse.json(
      { error: 'Failed to list folder contents' },
      { status: 500 }
    )
  }
}
