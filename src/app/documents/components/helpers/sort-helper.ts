/**
 * Convert size string like "1.5 MB" to bytes for proper comparison
 */
interface TableRow {
  getValue: (columnId: string) => string
}

export function getSizeInBytes(sizeStr: string): number {
  const units: Record<string, number> = {
    Bytes: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  }

  const parts = sizeStr.split(' ')
  if (parts.length !== 2) return 0

  const value = parseFloat(parts[0])
  const unit = parts[1]

  return value * (units[unit] ?? 1)
}

/**
 * Custom sorting function for size (converts "1.5 MB" to bytes for proper comparison)
 */
export function sortBySize(
  rowA: TableRow,
  rowB: TableRow,
  columnId: string
): number {
  const sizeA = getSizeInBytes(rowA.getValue(columnId))
  const sizeB = getSizeInBytes(rowB.getValue(columnId))

  return sizeA - sizeB
}
