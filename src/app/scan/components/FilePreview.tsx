'use client'

import { X } from 'lucide-react'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface FilePreviewProps {
  readonly selectedImage: string | null
  readonly selectedFile: File | null
  readonly onRemove: () => void
  readonly isUploading: boolean
  readonly uploadProgress: number
}

export function FilePreview({
  selectedImage,
  selectedFile,
  onRemove,
  isUploading,
  uploadProgress
}: FilePreviewProps) {
  if (!selectedImage || !selectedFile) {
    return null
  }

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <div className='relative w-full' style={{ height: '500px' }}>
          <Image
            src={selectedImage}
            alt='Selected document'
            fill
            className='object-contain'
            sizes='(max-width: 768px) 100vw, 800px'
            priority
          />
          <Button
            variant='ghost'
            size='icon'
            onClick={onRemove}
            disabled={isUploading}
            className='absolute top-2 right-2 bg-background/80 hover:bg-background'
          >
            <X className='h-4 w-4' />
          </Button>
        </div>

        {isUploading && (
          <div className='p-4'>
            <Progress value={uploadProgress} className='h-2' />
            <p className='text-xs text-muted-foreground mt-1 text-center'>
              {uploadProgress}% uploaded
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
