// src/app/api/folders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFolderById, renameFolder, deleteFolder } from '@/lib/folder-manager'

// GET: Get folder details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const folderId = params.id

    // Get folder details
    const folder = await getFolderById(folderId)

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Error getting folder details:', error)
    return NextResponse.json(
      { error: 'Failed to get folder details' },
      { status: 500 }
    )
  }
}

// PATCH: Rename folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const folderId = params.id
    const { name } = await request.json()

    // Validate inputs
    if (!name) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Rename the folder
    const updatedFolder = await renameFolder(folderId, name)

    if (!updatedFolder) {
      return NextResponse.json(
        { error: 'Folder not found or could not be renamed' },
        { status: 404 }
      )
    }

    return NextResponse.json({ folder: updatedFolder })
  } catch (error) {
    console.error('Error renaming folder:', error)
    return NextResponse.json(
      { error: 'Failed to rename folder' },
      { status: 500 }
    )
  }
}

// DELETE: Delete folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const folderId = params.id

    // Delete the folder
    const success = await deleteFolder(folderId)

    if (!success) {
      return NextResponse.json(
        { error: 'Folder not found or could not be deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
