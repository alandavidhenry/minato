// src/components/upload-button.tsx
'use client'

import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function UploadButton() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', event.target.files[0])

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      // Refresh the page to show the new document
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div>
      <label
        className={cn(
          buttonVariants(),
          !session && 'cursor-not-allowed opacity-50'
        )}
      >
        <Upload className='h-4 w-4' />
        <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
        <input
          type='file'
          className='hidden'
          onChange={handleUpload}
          disabled={!session || isUploading}
        />
      </label>
    </div>
  )
}
