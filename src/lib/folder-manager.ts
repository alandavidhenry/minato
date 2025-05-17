// src/lib/folder-manager.ts

import { getFileManager } from './file-manager'

/**
 * @deprecated Use FileManager from file-manager.ts instead
 * Creates an empty folder in blob storage
 */
export async function createEmptyFolder(folderPath: string): Promise<string> {
  console.warn(
    'createEmptyFolder is deprecated. Use FileManager.createFolder instead.'
  )
  const fileManager = getFileManager()
  const result = await fileManager.createFolder(
    folderPath,
    'system',
    'System Migration'
  )

  return result.success ? folderPath : ''
}

/**
 * @deprecated Use FileManager.folderExists from file-manager.ts instead
 * Checks if a folder exists by checking for the placeholder file
 */
export async function folderExists(folderPath: string): Promise<boolean> {
  const fileManager = getFileManager()
  return await fileManager.folderExists(folderPath)
}

/**
 * @deprecated Use FileManager from file-manager.ts instead
 * Move or copy a folder and its contents
 */
export async function moveOrCopyFolder(
  sourceFolderPath: string,
  targetPath: string,
  operation: 'move' | 'copy'
): Promise<string | null> {
  console.warn(
    'moveOrCopyFolder is deprecated. Use FileManager methods instead.'
  )
  const fileManager = getFileManager()

  if (operation === 'move') {
    // Parse the target folder name from the path
    const targetName = targetPath.split('/').pop() ?? ''
    const result = await fileManager.renameFolder(
      sourceFolderPath,
      targetName,
      'system',
      'System Migration'
    )
    return result.success ? targetPath : null
  } else {
    // Copy operation is more complex and should be implemented in file-manager
    console.error('Copy folder operation is not supported in the legacy API')
    return null
  }
}

/**
 * @deprecated Use FileManager.listContent from file-manager.ts instead
 * Lists all files and subfolders in a folder
 */
export async function listFolderContents(
  folderPath: string
): Promise<string[]> {
  console.warn(
    'listFolderContents is deprecated. Use FileManager.listContent instead.'
  )
  const fileManager = getFileManager()
  const contents = await fileManager.listContent(folderPath)

  // Convert to the old format (just paths)
  return contents.map((item) => item.fullPath)
}

/**
 * @deprecated Use FileManager from file-manager.ts instead
 * Rename a file or folder
 */
export async function renameItem(
  oldPath: string,
  newName: string,
  isFolder: boolean
): Promise<string | null> {
  console.warn(
    'renameItem is deprecated. Use FileManager.renameFile or FileManager.renameFolder instead.'
  )
  const fileManager = getFileManager()

  if (isFolder) {
    const result = await fileManager.renameFolder(
      oldPath,
      newName,
      'system',
      'System Migration'
    )
    return result.success ? (result.data?.newPath ?? null) : null
  } else {
    const result = await fileManager.renameFile(
      oldPath,
      newName,
      'system',
      'System Migration'
    )
    return result.success ? (result.data?.newPath ?? null) : null
  }
}
