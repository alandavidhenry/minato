// src/lib/file-system/path-utils.ts

// Constants
export const FOLDER_SEPARATOR = '/'
export const FOLDER_MARKER = '.folder'

/**
 * Normalize a path to ensure consistent format
 */
export function normalizePath(path: string): string {
  // Remove leading and trailing slashes and spaces
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')

  // For root path, return empty string
  if (normalizedPath === '' || normalizedPath === '/') {
    return ''
  }

  return normalizedPath
}

/**
 * Get the full path including folder marker if it's a folder
 */
export function getFolderMarkerPath(folderPath: string): string {
  const normalizedPath = normalizePath(folderPath)
  return normalizedPath
    ? `${normalizedPath}${FOLDER_SEPARATOR}${FOLDER_MARKER}`
    : FOLDER_MARKER
}

/**
 * Validate a file or folder name
 */
export function isValidName(name: string): boolean {
  // Check if the name contains invalid characters
  const invalidChars = /[*?:";|<>\\]/
  return !invalidChars.test(name) && name.trim() !== '' && name.length <= 255
}

/**
 * Check if a path is a direct child of the current path
 */
export function isDirectChild(
  path: string,
  currentPath: string,
  separator: string = FOLDER_SEPARATOR
): boolean {
  if (!currentPath) {
    // If current path is root, check if the path has no slashes
    return path.indexOf(separator) === -1
  }

  // Split both paths
  const currentParts = currentPath.split(separator)
  const pathParts = path.split(separator)

  // A direct child has exactly one more segment than the current path
  return (
    pathParts.length === currentParts.length + 1 &&
    path.startsWith(currentPath + separator)
  )
}
