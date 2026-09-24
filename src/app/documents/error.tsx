// src/app/documents/error.tsx
'use client'

import { useEffect } from 'react'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className='grid gap-4'>
      <PageHeader
        title='Something went wrong!'
        description='Failed to load documents. Please try again.'
      />
      <div>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  )
}
