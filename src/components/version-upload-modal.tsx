// src/components/version-upload-modal.tsx
'use client'

import { Cloud, File, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/use-toast'

interface VersionUploadModalProps {
  readonly originalFileName: string
  readonly folderPath?: string
  readonly onClose: () => void
  readonly onVersionUploaded: () => void
}

export function VersionUploadModal({
  originalFileName,
  folderPath = '',
  onClose,
  onVersionUploaded
}: VersionUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      setSelectedFile(files[0])
    }
  }

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('isNewVersion', 'true')
    formData.append('originalFileName', originalFileName)

    // Add folder path if specified
    if (folderPath) {
      formData.append('folderPath', folderPath)
    }

    try {
      // Use XMLHttpRequest for progress monitoring
      const xhr = new XMLHttpRequest()

      // Set up progress monitoring
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
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
        title: 'New version uploaded',
        description: `New version of ${originalFileName} has been uploaded.`,
        duration: 3000
      })

      // Call the callback
      onVersionUploaded()

      // Close the modal
      onClose()

      // Refresh the page to show the new version
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
  }

  return (
    <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
      <div className='bg-background rounded-lg shadow-lg p-6 max-w-md w-full transform transition-all duration-300'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>Upload New Version</h2>
          <Button
            variant='ghost'
            size='icon'
            onClick={onClose}
            disabled={isUploading}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>

        <div className='mb-4 text-sm text-muted-foreground'>
          <p>
            Uploading a new version of:{' '}
            <span className='font-semibold'>{originalFileName}</span>
          </p>
        </div>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer mb-4 ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className='flex flex-col items-center justify-center gap-2 text-center py-4'>
              <Cloud className='h-10 w-10 text-muted-foreground' />
              <p className='font-medium'>Drag & drop file here</p>
              <p className='text-sm text-muted-foreground'>
                or click to browse files
              </p>
              <input
                ref={fileInputRef}
                type='file'
                className='hidden'
                onChange={handleFileSelection}
                disabled={isUploading}
              />
            </div>
          </div>
        ) : (
          <div className='mb-4 border rounded-lg p-4'>
            <div className='flex items-center gap-2'>
              <File className='h-8 w-8 text-muted-foreground' />
              <div className='flex-1 overflow-hidden'>
                <p className='font-medium truncate'>{selectedFile.name}</p>
                <p className='text-xs text-muted-foreground'>
                  {formatBytes(selectedFile.size)}
                </p>
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                <X className='h-4 w-4' />
              </Button>
            </div>

            {isUploading && (
              <div className='mt-2'>
                <Progress value={uploadProgress} className='h-2' />
                <p className='text-xs text-muted-foreground mt-1'>
                  {uploadProgress}% uploaded
                </p>
              </div>
            )}
          </div>
        )}

        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className='gap-2'
          >
            <Upload className='h-4 w-4' />
            {isUploading ? 'Uploading...' : 'Upload New Version'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
