'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SharedDocumentViewer() {
  const searchParams = useSearchParams()
  const url = searchParams.get('url')
  const name = searchParams.get('name') ?? 'Document'

  if (!url) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center p-4'>
        <div className='w-full max-w-md space-y-4 text-center'>
          <h1 className='text-2xl font-bold text-destructive'>Invalid Link</h1>
          <p className='text-muted-foreground'>
            This link is missing required parameters.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen flex-col'>
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <span className='text-sm font-medium truncate'>{name}</span>
        <a
          href={url}
          download={name}
          className='text-sm text-primary underline'
        >
          Download
        </a>
      </div>
      <div className='flex-1'>
        <iframe src={url} className='h-full w-full min-h-screen' title={name} />
      </div>
    </div>
  )
}

export default function SharedViewPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent' />
        </div>
      }
    >
      <SharedDocumentViewer />
    </Suspense>
  )
}
