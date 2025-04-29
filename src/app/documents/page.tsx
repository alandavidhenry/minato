// src/app/documents/page.tsx
import { notFound } from 'next/navigation'

import { ArrowUp } from 'lucide-react'
import { columns } from '@/app/documents/components/columns'
import { CreateFolderButton } from '@/components/create-folder-button'
import { DocumentBreadcrumb } from '@/components/document-breadcrumb'
import { DragDropUploader } from '@/components/drag-drop-uploader'
import { UpLevelButton } from '@/components/up-level-button'
import { Button } from '@/components/ui/button'
import { folderExists } from '@/lib/folder-manager'
import { listBlobs } from '@/lib/list-blobs'

import { DataTable } from './data-table'

export const dynamic = 'force-dynamic'

type DocumentsPageProps = {
  readonly params: Record<string, string>
  readonly searchParams: { [key: string]: string | string[] | undefined }
}

export default async function DocumentsPage({
  searchParams
}: DocumentsPageProps) {
  // Get current path from query parameters
  const resolvedSearchParams = await searchParams
  const pathParam = resolvedSearchParams.path
  const path = typeof pathParam === 'string' ? pathParam : ''

  // If path is provided, verify it exists
  if (path) {
    const exists = await folderExists(path)
    if (!exists) {
      notFound()
    }
  }

  // Fetch documents from Azure Storage for the current path
  const documents = await listBlobs(false, path)

  return (
    <div className='grid gap-4'>
      {/* Breadcrumb navigation */}
      <DocumentBreadcrumb currentPath={path} />

      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 md:px-0'>
        <div className='flex items-center gap-2'>
          {path && <UpLevelButton currentPath={path} />}
        </div>
        <div className='flex flex-wrap gap-2'>
          <CreateFolderButton currentPath={path} />
          <DragDropUploader currentPath={path} />
        </div>
      </div>

      <DataTable columns={columns} data={documents} />
    </div>
  )
}
