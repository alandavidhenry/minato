'use client'

import { Camera, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface UploadControlsProps {
  readonly onUploadClick: () => void
  readonly onCameraClick: () => void
  readonly onUploadSubmit: () => void
  readonly hasCamera: boolean
  readonly isCameraActive: boolean
  readonly isUploading: boolean
  readonly isLoading: boolean
  readonly selectedFile: File | null
}

export function UploadControls({
  onUploadClick,
  onCameraClick,
  onUploadSubmit,
  hasCamera,
  isCameraActive,
  isUploading,
  isLoading,
  selectedFile
}: UploadControlsProps) {
  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap gap-4'>
        <Button
          onClick={onUploadClick}
          disabled={isLoading || isCameraActive || isUploading}
          className='gap-2'
        >
          <Upload className='h-4 w-4' />
          Import Image
        </Button>

        {hasCamera && (
          <Button
            onClick={onCameraClick}
            disabled={isLoading || isUploading}
            variant={isCameraActive ? 'destructive' : 'default'}
            className='gap-2'
          >
            <Camera className='h-4 w-4' />
            {isCameraActive ? 'Stop Camera' : 'Use Camera'}
          </Button>
        )}
      </div>

      {selectedFile && (
        <Button
          onClick={onUploadSubmit}
          disabled={isUploading || !selectedFile}
          className='w-full md:w-auto gap-2'
        >
          {isUploading ? (
            <>
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className='h-4 w-4' />
              Upload Document
            </>
          )}
        </Button>
      )}
    </div>
  )
}
