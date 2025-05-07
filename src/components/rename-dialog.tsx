'use client'

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
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface RenameDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly name: string
  readonly isFolder: boolean
  readonly path: string
}

export function RenameDialog({
  open,
  onOpenChange,
  name,
  isFolder,
  path
}: RenameDialogProps) {
  const { data: session } = useSession()
  const [isProcessing, setIsProcessing] = useState(false)

  // Extract display name (without path) for input field
  const displayName = isFolder
    ? (path.split('/').pop() ?? path)
    : (name.split('/').pop() ?? name)

  // For files, remove the extension for better UX
  const baseNameWithoutExtension = isFolder
    ? displayName
    : displayName.includes('.')
      ? displayName.substring(0, displayName.lastIndexOf('.'))
      : displayName

  const [newName, setNewName] = useState(baseNameWithoutExtension)

  const handleRename = async () => {
    if (!session || isProcessing || !newName.trim()) return

    // If this is a file and it had an extension, keep the original extension
    const nameToSubmit = isFolder ? newName.trim() : newName.trim()

    setIsProcessing(true)
    try {
      const response = await fetch('/api/documents/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          oldPath: path,
          newName: nameToSubmit,
          isFolder
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Rename operation failed')
      }

      toast({
        title: `${isFolder ? 'Folder' : 'File'} renamed`,
        description: `Successfully renamed to ${newName}`,
        duration: 3000
      })

      // Refresh the page to update the document list
      window.location.reload()
    } catch (error) {
      console.error('Rename error:', error)
      toast({
        title: 'Rename failed',
        description:
          error instanceof Error ? error.message : 'Failed to rename',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsProcessing(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Rename {isFolder ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>
            Enter a new name for this {isFolder ? 'folder' : 'file'}.
          </DialogDescription>
        </DialogHeader>

        <div className='py-4'>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>New name</Label>
              <Input
                id='name'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Enter new ${isFolder ? 'folder' : 'file'} name`}
                disabled={isProcessing}
                autoFocus
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={
              isProcessing ||
              !newName.trim() ||
              newName.trim() === baseNameWithoutExtension
            }
            className='gap-2'
          >
            {isProcessing ? (
              <>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></span>
                {' Renaming...'}
              </>
            ) : (
              'Rename'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
