// src/app/api/folders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import {
  createFolder,
  listFolderContents,
  initFoldersTable
} from '@/lib/folder-manager'

// Initialize the folders table
initFoldersTable().catch(console.error)

// GET: List folder contents
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get folder path from query parameter
    const folderPath = request.nextUrl.searchParams.get('path') ?? ''

    // List folder contents
    const contents = await listFolderContents(folderPath)

    return NextResponse.json({ contents })
  } catch (error) {
    console.error('Error listing folder contents:', error)
    return NextResponse.json(
      { error: 'Failed to list folder contents' },
      { status: 500 }
    )
  }
}

// POST: Create a new folder
export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, parentPath } = await request.json()

    // Validate inputs
    if (!name) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Create the folder
    const folder = await createFolder(name, parentPath || '')

    if (!folder) {
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      )
    }

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
