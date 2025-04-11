'use client'

import { Cloud } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRef } from 'react'

import { Card, CardContent } from '@/components/ui/card'

interface FileDropzoneProps {
  readonly isDragging: boolean
  readonly onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  readonly onFileSelect: (file: File) => void
  readonly isUploading: boolean
}

export function FileDropzone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  isUploading
}: FileDropzoneProps) {
  const { data: session } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    onFileSelect(e.target.files[0])

    // Reset input value to allow uploading the same file again
    e.target.value = ''
  }

  return (
    <Card className='border-dashed'>
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        } ${!session ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isUploading && session && fileInputRef.current?.click()}
      >
        <CardContent className='flex flex-col items-center justify-center gap-2 text-center py-4'>
          <Cloud className='h-10 w-10 text-muted-foreground' />
          <p className='font-medium'>Drag & drop file here</p>
          <p className='text-sm text-muted-foreground'>
            or click to browse files
          </p>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleFileSelection}
            disabled={!session || isUploading}
          />
        </CardContent>
      </div>
    </Card>
  )
}
