export const FOLDER_SEPARATOR = '/'
export const FOLDER_MARKER = '.folder'

export function normalizePath(path: string): string {
  return path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
}

export function getFolderMarkerPath(folderPath: string): string {
  const normalizedPath = normalizePath(folderPath)
  return normalizedPath
    ? `${normalizedPath}${FOLDER_SEPARATOR}${FOLDER_MARKER}`
    : FOLDER_MARKER
}

export function isValidName(name: string): boolean {
  const invalidChars = /[*?:";|<>\\]/
  return !invalidChars.test(name) && name.trim() !== '' && name.length <= 255
}

export function isDirectChild(path: string, currentPath: string): boolean {
  if (!currentPath) {
    return path.indexOf(FOLDER_SEPARATOR) === -1
  }

  const currentParts = currentPath.split(FOLDER_SEPARATOR)
  const pathParts = path.split(FOLDER_SEPARATOR)

  return (
    pathParts.length === currentParts.length + 1 &&
    path.startsWith(currentPath + FOLDER_SEPARATOR)
  )
}
