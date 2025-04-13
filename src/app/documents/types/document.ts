// src/app/documents/types/document.ts
export interface Document {
  id: string
  name: string
  uploadedAt: string
  type: string
  size: string
  hasVersions: boolean
  versionNumber?: number
  totalVersions?: number
  originalName?: string
  isFolder?: boolean
  path?: string
}
