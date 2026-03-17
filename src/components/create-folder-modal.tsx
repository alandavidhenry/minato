// src/components/create-folder-modal.tsx
'use client'

import { FolderPlus } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'

interface CreateFolderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPath?: string
}

export function CreateFolderModal({
  open,
  onOpenChange,
  currentPath = ''
}: CreateFolderModalProps) {
  const { data: session } = useSession()
  const [folderName, setFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes
  if (!open && (folderName || error)) {
    setFolderName('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session || isCreating) return

    // Validate folder name
    const trimmedName = folderName.trim()
    if (!trimmedName) {
      setError('Please enter a folder name')
      return
    }

    // Check for invalid characters
    const invalidChars = /[*?:";|<>\\]/
    if (invalidChars.test(trimmedName)) {
      setError('Folder name cannot contain: * ? : " ; | < > \\')
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: trimmedName,
          path: currentPath
        })
      })

      // Handle error responses
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create folder')
      }

      // Show success message
      toast({
        title: 'Folder created',
        description: `${trimmedName} has been created successfully.`,
        duration: 3000
      })

      // Close the dialog
      onOpenChange(false)

      // Refresh the page to show the new folder
      window.location.reload()
    } catch (error) {
      console.error('Create folder error:', error)
      setError(
        error instanceof Error ? error.message : 'Failed to create folder'
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FolderPlus className='h-5 w-5' />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Enter a name for your new folder.
            {currentPath && (
              <span className='block mt-1 text-xs'>
                Location: {currentPath || 'Root'}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Input
              placeholder='Folder name'
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
              disabled={isCreating}
            />
            {error && <p className='text-destructive text-sm'>{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isCreating || !folderName.trim()}
              className='gap-2'
            >
              {isCreating ? (
                <>
                  <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></span>
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className='h-4 w-4' />
                  Create Folder
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
