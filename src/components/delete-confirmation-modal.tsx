// src/components/delete-confirmation-modal.tsx
'use client'

import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

interface DeleteConfirmationModalProps {
  readonly fileNames: string | string[] // Accepts a single filename or array of filenames
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isDeleting: boolean
}

export function DeleteConfirmationModal({
  fileNames,
  onConfirm,
  onCancel,
  isDeleting
}: DeleteConfirmationModalProps) {
  const [isVisible, setIsVisible] = useState(true)

  const fileCount = Array.isArray(fileNames) ? fileNames.length : 1
  const isMultiple = fileCount > 1

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onCancel, 300) // Allow for fade-out animation
  }

  const handleConfirm = () => {
    onConfirm()
  }

  // Extract the confirmation message logic to avoid nested ternary
  const getConfirmationMessage = () => {
    if (isMultiple) {
      return `Are you sure you want to delete these ${fileCount} documents?`
    }

    const displayFileName = Array.isArray(fileNames) ? fileNames[0] : fileNames
    return `Are you sure you want to delete "${displayFileName}"?`
  }

  return (
    <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
      <Card
        className={`w-full max-w-md transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-xl text-destructive flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            Confirm Deletion
          </CardTitle>
          <Button
            variant='ghost'
            size='icon'
            onClick={handleClose}
            disabled={isDeleting}
          >
            <X className='h-4 w-4' />
          </Button>
        </CardHeader>

        <CardContent className='pt-4'>
          <div className='space-y-4'>
            <p className='text-muted-foreground'>{getConfirmationMessage()}</p>
            {isMultiple && (
              <div className='max-h-32 overflow-y-auto border rounded-md p-2 text-sm'>
                <ul className='list-disc pl-4'>
                  {(fileNames as string[]).map((fileName) => (
                    <li key={`file-${fileName}`}>{fileName}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className='text-destructive font-semibold text-sm'>
              This action cannot be undone.
            </p>
          </div>
        </CardContent>

        <CardFooter className='flex justify-between'>
          <Button variant='outline' onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>

          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={isDeleting}
            className='gap-2'
          >
            {isDeleting ? (
              <>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></span>
                {' Deleting...'}
              </>
            ) : (
              <>
                <Trash2 className='h-4 w-4' />
                Delete {isMultiple ? 'Files' : 'File'}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
