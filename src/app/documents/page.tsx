// src/app/documents/page.tsx
import { DragDropUploader } from '@/components/drag-drop-uploader'
import { listBlobs } from '@/lib/list-blobs'

import { columns } from './columns'
import { DataTable } from './data-table'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  // Fetch documents from Azure Storage
  const documents = await listBlobs()

  return (
    <div className='grid gap-4'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 md:px-0'>
        <h1 className='text-2xl sm:text-3xl font-bold'>Documents</h1>
        <DragDropUploader />
      </div>

      <DataTable columns={columns} data={documents} />
    </div>
  )
}
