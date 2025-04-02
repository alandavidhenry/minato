// src/app/auth/error/loading.tsx
export default function Loading() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md space-y-8'>
        <div className='h-8 w-48 animate-pulse rounded-md bg-red-100 mx-auto' />
        <div className='h-24 animate-pulse rounded-md bg-red-50' />
      </div>
    </div>
  )
}
