// src/components/drag-drop-uploader.tsx
'use client'

import { Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/use-toast'

export function DragDropUploader() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)

      try {
        // Use XMLHttpRequest for progress monitoring
        const xhr = new XMLHttpRequest()

        // Set up progress monitoring
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            )
            setUploadProgress(percentComplete)
          }
        })

        // Create a promise to handle the response
        const uploadPromise = new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          }
          xhr.onerror = () => reject(new Error('Network error during upload'))
        })

        // Configure and send the request
        xhr.open('POST', '/api/documents/upload', true)
        xhr.send(formData)

        // Wait for the upload to complete
        await uploadPromise

        // Success notification
        toast({
          title: 'Upload successful',
          description: `${file.name} has been uploaded.`,
          duration: 3000
        })

        // Close the upload area after successful upload
        setIsVisible(false)

        // Refresh the page to show the new document
        router.refresh()
      } catch (error) {
        console.error('Upload error:', error)
        toast({
          title: 'Upload failed',
          description:
            error instanceof Error ? error.message : 'Failed to upload file',
          variant: 'destructive',
          duration: 3000
        })
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    [router]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to upload documents',
          variant: 'destructive'
        })
        return
      }

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Upload each file
      for (const file of files) {
        await uploadFile(file)
      }
    },
    [session, uploadFile]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length || !session) return

      const file = e.target.files[0]
      await uploadFile(file)

      // Reset input value to allow uploading the same file again
      e.target.value = ''
    },
    [session, uploadFile]
  )

  const toggleUploader = useCallback(() => {
    setIsVisible((prev) => !prev)
  }, [])

  return (
    <div className='relative w-full sm:w-auto'>
      {/* Button to toggle the drag-drop uploader */}
      <Button
        onClick={toggleUploader}
        disabled={!session || isUploading}
        className='w-full sm:w-auto flex items-center gap-2'
      >
        <Upload className='h-4 w-4' />
        {isVisible ? 'Hide' : 'Upload Document'}
      </Button>

      {/* Animated Drag-Drop Area - Positioned absolutely */}
      <div
        className={`absolute right-0 z-10 w-full sm:w-[32rem] transition-all duration-300 ease-in-out ${
          isVisible ? 'opacity-100 top-12 visible' : 'opacity-0 top-0 invisible'
        }`}
      >
        <div
          role='button'
          tabIndex={0}
          aria-label='Drop files here to upload'
          className={`border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 transition-colors shadow-lg bg-background ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50'
          } ${!session ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() =>
            !isUploading &&
            session &&
            document.getElementById('file-input')?.click()
          }
        >
          <div className='flex flex-col items-center justify-center gap-2 text-center py-4'>
            <Upload className='h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground' />
            <h3 className='text-lg font-medium'>Upload File</h3>
            <p className='text-sm text-muted-foreground'>
              Tap to browse or drop files
            </p>
            <label className='mt-2 md:mt-4'>
              <Button
                disabled={!session || isUploading}
                className={`${isUploading ? 'cursor-not-allowed' : ''} md:text-lg md:py-6 md:px-8`}
                onClick={(e) => {
                  // Prevent parent div's click handler from firing
                  e.stopPropagation()
                  // Directly trigger the file input click
                  document.getElementById('file-input')?.click()
                }}
              >
                {isUploading ? 'Uploading...' : 'Browse Files'}
              </Button>
              <input
                id='file-input'
                type='file'
                className='hidden'
                onChange={handleFileSelect}
                disabled={!session || isUploading}
              />
            </label>

            {isUploading && (
              <div className='w-full mt-4 max-w-md mx-auto'>
                <Progress
                  value={uploadProgress}
                  className='h-2 md:h-3 w-full'
                />
                <p className='text-xs md:text-sm text-muted-foreground mt-1 text-center'>
                  {uploadProgress}% uploaded
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
