// src/components/rename-dialog.tsx
'use client'

import { Pencil } from 'lucide-react'
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
import { parseFileName } from '@/lib/version-manager'

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  isFolder?: boolean
  path?: string
}

export function RenameDialog({
  open,
  onOpenChange,
  name,
  isFolder = false,
  path = ''
}: RenameDialogProps) {
  const { data: session } = useSession()
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Initialize the new name when dialog opens
  if (open && newName === '') {
    if (isFolder) {
      // For folders, use the folder name (last part of the path)
      const folderName = path.split('/').pop() ?? name
      setNewName(folderName)
    } else {
      // For files, strip the extension
      const { baseName } = parseFileName(name)
      setNewName(baseName)
    }
  }

  const handleRename = async () => {
    if (!session || isRenaming || !newName.trim()) return

    setError(null)
    setIsRenaming(true)

    try {
      // Important: Use the full path for both files and folders
      const itemPath = isFolder ? path : name

      console.log(`Renaming item: ${itemPath} to ${newName.trim()}`)

      const response = await fetch('/api/documents/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: itemPath,
          newName: newName.trim(),
          isFolder
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Rename failed')
      }

      const data = await response.json()

      toast({
        title: 'Renamed successfully',
        description: data.message,
        duration: 3000
      })

      // Close the dialog
      onOpenChange(false)

      // Refresh the page to update the file list
      window.location.reload()
    } catch (error) {
      console.error('Rename error:', error)
      setError(error instanceof Error ? error.message : 'Failed to rename')
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Pencil className='h-4 w-4' />
            Rename {isFolder ? 'Folder' : 'File'}
          </DialogTitle>
          <DialogDescription>
            {isFolder
              ? 'Enter a new name for this folder.'
              : 'Enter a new name for this file. The extension will be preserved.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Input
              placeholder='New name'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              disabled={isRenaming}
            />
            {error && <p className='text-destructive text-sm'>{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={isRenaming || !newName.trim()}
            className='gap-2'
          >
            {isRenaming ? (
              <>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></span>
                Renaming...
              </>
            ) : (
              <>
                <Pencil className='h-4 w-4' />
                Rename
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
