// src/app/documents/page.tsx
import { Suspense } from 'react'

import { DocumentList } from '@/components/document-list'

export const dynamic = 'force-dynamic'

export default function DocumentsPage() {
  return (
    <div className='grid gap-4'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 md:px-0'>
        <h1 className='text-2xl sm:text-3xl font-bold'>Documents</h1>
      </div>

      <Suspense fallback={<div>Loading documents...</div>}>
        <DocumentList />
      </Suspense>
    </div>
  )
}
