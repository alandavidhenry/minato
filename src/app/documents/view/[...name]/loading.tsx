// src/app/documents/view/[...name]/loading.tsx
export default function Loading() {
  return (
    <div className='container mx-auto py-4'>
      <div className='flex flex-col gap-4'>
        <div className='flex items-center gap-2'>
          <div className='h-9 w-24 animate-pulse rounded-md bg-muted' />
          <div className='h-8 w-64 animate-pulse rounded-md bg-muted' />
        </div>
        <div className='h-[800px] w-full animate-pulse rounded-lg bg-muted' />
      </div>
    </div>
  )
}
