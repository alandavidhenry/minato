// src/app/api/documents/versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getDocumentVersions } from '@/lib/list-blobs'

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const baseName = searchParams.get('baseName')

  if (!baseName) {
    return NextResponse.json(
      { error: 'Base name is required' },
      { status: 400 }
    )
  }

  try {
    // Get all versions of this document
    const versions = await getDocumentVersions(baseName)

    // Format versions for the response
    const formattedVersions = versions.map((version) => ({
      fileName: version.name,
      versionNumber: version.versionNumber,
      uploadedAt: version.uploadedAt,
      size: version.size
    }))

    return NextResponse.json({
      versions: formattedVersions,
      totalVersions: versions.length
    })
  } catch (error) {
    console.error('Error fetching document versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document versions' },
      { status: 500 }
    )
  }
}
