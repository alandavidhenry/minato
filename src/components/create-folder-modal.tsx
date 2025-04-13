// src/components/create-folder-modal.tsx
'use client'

import { Folder } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface CreateFolderModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onFolderCreated: () => void
  readonly currentPath?: string
}

export function CreateFolderModal({
  open,
  onOpenChange,
  onFolderCreated,
  currentPath = ''
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!folderName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Folder name is required',
        variant: 'destructive'
      })
      return
    }

    // Check for invalid characters
    if (/[\\/:*?"<>|]/.test(folderName)) {
      toast({
        title: 'Validation Error',
        description: 'Folder name contains invalid characters',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      // Full path for the new folder
      const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName

      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: fullPath })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to create folder')
      }

      toast({
        title: 'Success',
        description: `Folder "${folderName}" created successfully`
      })

      // Reset and close
      setFolderName('')
      onFolderCreated()
      onOpenChange(false)
    } catch (error) {
      console.error('Create folder error:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create folder',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Folder className='h-5 w-5' />
              Create New Folder
            </DialogTitle>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {currentPath && (
              <div className='text-sm'>
                <span className='text-muted-foreground'>Current location:</span>{' '}
                {currentPath}
              </div>
            )}

            <div className='grid gap-2'>
              <Label htmlFor='folderName'>Folder Name</Label>
              <Input
                id='folderName'
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder='New Folder'
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
