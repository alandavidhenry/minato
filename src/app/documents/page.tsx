// src/app/documents/page.tsx
import { notFound } from 'next/navigation'

import { columns, rootColumns } from '@/app/documents/components/columns'
import { CreateFolderButton } from '@/components/create-folder-button'
import { DocumentBreadcrumb } from '@/components/document-breadcrumb'
import { DragDropUploader } from '@/components/drag-drop-uploader'
import { UpLevelButton } from '@/components/up-level-button'
import { formatSize, getFileManager } from '@/lib/file-system'
import { listBlobs } from '@/lib/list-blobs'

import { DataTable } from './data-table'

export const dynamic = 'force-dynamic'

// Folders managed by the system API — not user-created company folders.
// Hide these from the root browser so admins don't accidentally browse or
// modify programmatically-stored blobs (completion PDFs, template files).
const SYSTEM_FOLDERS = new Set(['completions', 'templates'])

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const pathParam = resolvedSearchParams.path
  const path = typeof pathParam === 'string' ? pathParam : ''
  const isRoot = !path

  const fileManager = getFileManager()

  // If path is provided, verify it exists
  if (path) {
    const exists = await fileManager.folderExists(path)
    if (!exists) {
      notFound()
    }
  }

  // Fetch documents from Azure Storage for the current path
  const allDocuments = await listBlobs(false, path)
  // At root, hide system-managed folders that aren't user company folders
  const documents = isRoot
    ? allDocuments.filter((d) => !d.isFolder || !SYSTEM_FOLDERS.has(d.name))
    : allDocuments

  // At root, compute total size for each company folder
  if (isRoot) {
    for (const doc of documents) {
      if (doc.isFolder) {
        const totalBytes = await fileManager.getFolderSize(doc.name)
        doc.size = totalBytes > 0 ? formatSize(totalBytes) : '—'
      }
    }
  }

  return (
    <div className='grid gap-4'>
      {/* Breadcrumb navigation */}
      <DocumentBreadcrumb currentPath={path} />

      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 md:px-0'>
        <div className='flex items-center gap-2'>
          {path && <UpLevelButton currentPath={path} />}
        </div>
        <div className='flex flex-wrap gap-2'>
          {path && <CreateFolderButton currentPath={path} />}
          {path && <DragDropUploader currentPath={path} />}
        </div>
      </div>

      <DataTable
        columns={isRoot ? rootColumns : columns}
        data={documents}
        readOnly={isRoot}
      />
    </div>
  )
}
