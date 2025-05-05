// src/components/delete-confirmation-modal.tsx
'use client'

import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useState, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

interface DeleteItem {
  readonly name: string
  readonly isFolder: boolean
  readonly path?: string
}

interface DeleteConfirmationModalProps {
  readonly items?: DeleteItem[]
  readonly fileNames?: string | string[]
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isDeleting: boolean
}

export function DeleteConfirmationModal({
  items,
  fileNames,
  onConfirm,
  onCancel,
  isDeleting
}: DeleteConfirmationModalProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Convert legacy fileNames to items format if needed
  const normalizedItems: DeleteItem[] = useMemo(() => {
    if (items && items.length > 0) {
      return items
    }

    // Convert fileNames to items format
    if (Array.isArray(fileNames)) {
      return fileNames.map((name) => ({ name, isFolder: false }))
    } else if (fileNames) {
      return [{ name: fileNames, isFolder: false }]
    }

    return []
  }, [items, fileNames])

  const itemCount = normalizedItems.length
  const isMultiple = itemCount > 1
  const folderCount = normalizedItems.filter((item) => item.isFolder).length
  const fileCount = itemCount - folderCount

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onCancel, 300) // Allow for fade-out animation
  }

  const handleConfirm = () => {
    onConfirm()
  }

  const getConfirmationMessage = () => {
    if (isMultiple) {
      if (folderCount > 0 && fileCount > 0) {
        return `Are you sure you want to delete these ${fileCount} documents and ${folderCount} folders?`
      } else if (folderCount > 0) {
        return `Are you sure you want to delete these ${folderCount} folders?`
      } else {
        return `Are you sure you want to delete these ${fileCount} documents?`
      }
    }

    if (normalizedItems.length === 1) {
      const item = normalizedItems[0]
      if (item.isFolder) {
        return `Are you sure you want to delete folder "${item.name}"?`
      }
      return `Are you sure you want to delete "${item.name}"?`
    }

    return 'Are you sure you want to delete this item?'
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
                  {normalizedItems.map((item, index) => (
                    <li
                      key={`item-${index}-${item.isFolder ? item.path : item.name}`}
                    >
                      {item.isFolder
                        ? `📁 ${item.name} (folder)`
                        : `📄 ${item.name}`}
                    </li>
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
                Delete{' '}
                {isMultiple
                  ? 'Items'
                  : normalizedItems[0]?.isFolder
                    ? 'Folder'
                    : 'File'}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
