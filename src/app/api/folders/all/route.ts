// src/app/api/folders/all/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getFileManager } from '@/lib/file-manager'

interface FolderStructure {
  name: string
  path: string
  fullPath: string
  isFolder: boolean
  children?: FolderStructure[]
}

interface ContentItem {
  name: string
  path: string
  fullPath: string
  isFolder: boolean
  size?: string
  type?: string
  uploadedAt?: string
  hasVersions?: boolean
  versionNumber?: number
  totalVersions?: number
  originalName?: string
}

interface FileManagerType {
  listContent: (path: string) => Promise<ContentItem[]>
}

export async function GET(_request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use the file manager to list all folders
    const fileManager = getFileManager()
    const rootContents = await fileManager.listContent('')

    // Filter to just folders
    const rootFolders = rootContents.filter((item) => item.isFolder)

    // Build the hierarchical structure
    const folderStructure: FolderStructure[] = []

    // For each root folder, fetch its contents recursively
    for (const folder of rootFolders) {
      const folderItem: FolderStructure = {
        name: folder.name,
        path: folder.path,
        fullPath: folder.fullPath,
        isFolder: true,
        children: await fetchFolderContents(folder.fullPath, fileManager)
      }
      folderStructure.push(folderItem)
    }

    return NextResponse.json({
      success: true,
      contents: folderStructure
    })
  } catch (error) {
    console.error('Error listing all folders:', error)
    return NextResponse.json(
      { error: 'Failed to list folder structure' },
      { status: 500 }
    )
  }
}

// Recursively fetch folder contents
async function fetchFolderContents(
  folderPath: string,
  fileManager: FileManagerType
): Promise<FolderStructure[]> {
  try {
    const contents = await fileManager.listContent(folderPath)

    // Filter to just folders
    const folders = contents.filter((item) => item.isFolder)

    // Build result
    const result: FolderStructure[] = []

    // For each subfolder, recursively fetch its contents
    for (const folder of folders) {
      const folderItem: FolderStructure = {
        name: folder.name,
        path: folder.path,
        fullPath: folder.fullPath,
        isFolder: true,
        children: await fetchFolderContents(folder.fullPath, fileManager)
      }
      result.push(folderItem)
    }

    return result
  } catch (error) {
    console.error(`Error fetching contents for ${folderPath}:`, error)
    return []
  }
}
