// src/app/documents/error.tsx
'use client'

import { useEffect } from 'react'

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
      <h1 className='text-3xl font-bold'>Something went wrong!</h1>
      <p className='text-muted-foreground'>
        Failed to load documents. Please try again.
      </p>
      <div>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  )
}
