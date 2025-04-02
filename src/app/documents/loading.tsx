// src/app/documents/loading.tsx
export default function Loading() {
  return (
    <div className='grid gap-4'>
      <div className='flex items-center justify-between'>
        <div className='h-9 w-36 animate-pulse rounded-md bg-muted' />
        <div className='h-9 w-40 animate-pulse rounded-md bg-muted' />
      </div>
      <div className='rounded-md border'>
        <div className='h-72 animate-pulse bg-muted' />
      </div>
    </div>
  )
}
