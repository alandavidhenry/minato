// src/app/s/[code]/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ShortUrlRedirect({
  params
}: {
  readonly params: { code: string }
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function resolveAndRedirect() {
      try {
        // Call the API to resolve the short URL
        const response = await fetch(`/api/shorturl/${params.code}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to resolve URL')
        }

        const { url } = await response.json()

        // Redirect to the original URL
        window.location.href = url
      } catch (error) {
        console.error('Redirect error:', error)
        setError(error instanceof Error ? error.message : 'An error occurred')
      }
    }

    resolveAndRedirect()
  }, [params.code, router])

  // If there's an error, show the error message
  if (error) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center p-4'>
        <div className='w-full max-w-md space-y-4 text-center'>
          <h1 className='text-2xl font-bold text-red-600'>Link Error</h1>
          <p className='text-muted-foreground'>{error}</p>
          <p>This link may have expired or is invalid.</p>
        </div>
      </div>
    )
  }

  // By default, show the loading spinner
  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md space-y-4 text-center'>
        <div className='mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
        <p className='text-muted-foreground'>
          Redirecting you to your document...
        </p>
      </div>
    </div>
  )
}
