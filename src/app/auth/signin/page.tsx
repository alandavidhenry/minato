// src/app/auth/signin/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Suspense } from 'react'

// Create a client component that uses useSearchParams
function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/documents'

  return (
    <div className='w-full max-w-md space-y-8'>
      <div>
        <h2 className='text-center text-3xl font-bold'>
          Sign in to Document Portal
        </h2>
      </div>
      <button
        onClick={() => signIn('azure-ad', { callbackUrl })}
        className='group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700'
      >
        Sign in with Azure AD
      </button>
    </div>
  )
}

// Add a loading fallback for the suspense boundary
function SignInLoading() {
  return (
    <div className='w-full max-w-md space-y-8'>
      <div>
        <h2 className='text-center text-3xl font-bold'>
          Sign in to Document Portal
        </h2>
      </div>
      <div className='group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white opacity-70'>
        Loading...
      </div>
    </div>
  )
}

// Main page component with Suspense
export default function SignIn() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <Suspense fallback={<SignInLoading />}>
        <SignInContent />
      </Suspense>
    </div>
  )
}
