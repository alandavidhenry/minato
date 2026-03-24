export const FOLDER_SEPARATOR = '/'
export const FOLDER_MARKER = '.folder'

export function normalizePath(path: string): string {
  const trimmed = path.trim()
  let start = 0
  let end = trimmed.length
  while (start < end && trimmed[start] === '/') start++
  while (end > start && trimmed[end - 1] === '/') end--
  return trimmed.slice(start, end)
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
    return !path.includes(FOLDER_SEPARATOR)
  }

  const currentParts = currentPath.split(FOLDER_SEPARATOR)
  const pathParts = path.split(FOLDER_SEPARATOR)

  return (
    pathParts.length === currentParts.length + 1 &&
    path.startsWith(currentPath + FOLDER_SEPARATOR)
  )
}
