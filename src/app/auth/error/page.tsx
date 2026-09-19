// src/app/auth/error/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ErrorPage() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(searchParams.get('error'))
  }, [searchParams])

  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md space-y-8'>
        <h2 className='text-center text-2xl font-semibold text-destructive'>
          Authentication Error
        </h2>
        <div className='rounded-md border border-destructive/30 bg-destructive/10 p-4'>
          <p className='text-sm text-destructive'>
            Error: {error ?? 'Unknown error occurred'}
          </p>
        </div>
      </div>
    </div>
  )
}
