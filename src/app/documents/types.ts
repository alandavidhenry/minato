// src/app/documents/types.ts
export type Document = {
  id: string
  name: string
  uploadedAt: string
  type: string
  size: string
  hasVersions: boolean
  versionNumber?: number
  totalVersions?: number
  originalName?: string
  path?: string
  folderPath?: string
  updatedAt?: string
}

export type TableMeta = {
  onAction?: () => void
}
