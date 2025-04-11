// src/components/folder-item.tsx
'use client'

import {
  CopyIcon,
  Folder,
  FolderEdit,
  FolderMinus,
  MoreHorizontal,
  MoveIcon
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { MoveDialog } from '@/components/move-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface FolderItemProps {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly onRename: () => void
  readonly onDelete: () => void
  readonly onMove: () => void
  readonly onCopy: () => void
}

export function FolderItem({
  id,
  name,
  path,
  onRename,
  onDelete,
  onMove,
  onCopy
}: FolderItemProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isMoveOpen, setIsMoveOpen] = useState(false)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
  const [newName, setNewName] = useState(name)
  const [isLoading, setIsLoading] = useState(false)

  // Navigate to the folder
  const navigateToFolder = () => {
    router.push(`/documents?path=${encodeURIComponent(path)}`)
  }

  // Handle rename folder
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newName.trim() || newName === name) {
      setIsRenameOpen(false)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename folder')
      }

      // Successfully renamed
      toast({
        title: 'Success',
        description: `Folder renamed to "${newName}"`
      })

      // Close dialog and notify parent
      setIsRenameOpen(false)
      onRename()
    } catch (error) {
      console.error('Error renaming folder:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to rename folder',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle delete folder
  const handleDelete = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete folder')
      }

      // Successfully deleted
      toast({
        title: 'Success',
        description: `Folder "${name}" deleted successfully`
      })

      // Close dialog and notify parent
      setIsDeleteOpen(false)
      onDelete()
    } catch (error) {
      console.error('Error deleting folder:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete folder',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle move operation
  const handleMove = async (targetPath: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetPath,
          operation: 'move'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to move folder')
      }

      // Successfully moved
      toast({
        title: 'Success',
        description: `Folder "${name}" moved successfully`
      })

      // Close dialog and notify parent
      setIsMoveOpen(false)
      onMove()
    } catch (error) {
      console.error('Error moving folder:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to move folder',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle copy operation
  const handleCopy = async (targetPath: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetPath,
          operation: 'copy'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to copy folder')
      }

      // Successfully copied
      toast({
        title: 'Success',
        description: `Folder "${name}" copied successfully`
      })

      // Close dialog and notify parent
      setIsCopyOpen(false)
      onCopy()
    } catch (error) {
      console.error('Error copying folder:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to copy folder',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Folder Item */}
      <div
        className='flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group'
        onClick={navigateToFolder}
      >
        <div className='flex items-center gap-2'>
          <Folder className='h-5 w-5 text-blue-500' />
          <span className='font-medium'>{name}</span>
        </div>

        {/* Actions Menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='opacity-0 group-hover:opacity-100'
              >
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsRenameOpen(true)
                }}
              >
                <FolderEdit className='h-4 w-4 mr-2' />
                Rename
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsMoveOpen(true)
                }}
              >
                <MoveIcon className='h-4 w-4 mr-2' />
                Move
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsCopyOpen(true)
                }}
              >
                <CopyIcon className='h-4 w-4 mr-2' />
                Copy
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsDeleteOpen(true)
                }}
                className='text-destructive focus:text-destructive'
              >
                <FolderMinus className='h-4 w-4 mr-2' />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename Folder</DialogTitle>
            </DialogHeader>

            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='newFolderName'>New Folder Name</Label>
                <Input
                  id='newFolderName'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsRenameOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isLoading || !newName.trim() || newName === name}
              >
                {isLoading ? 'Renaming...' : 'Rename'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
          </DialogHeader>

          <div className='py-4'>
            <p>
              Are you sure you want to delete the folder &quot;
              <strong>{name}</strong>&quot;?
            </p>
            <p className='text-sm text-muted-foreground mt-2'>
              This will delete all files and subfolders within this folder. This
              action cannot be undone.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsDeleteOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      {isMoveOpen && (
        <MoveDialog
          title={`Move Folder: ${name}`}
          currentPath={path}
          open={isMoveOpen}
          onOpenChange={setIsMoveOpen}
          onMove={handleMove}
          isLoading={isLoading}
          excludePath={path}
          type='folder'
        />
      )}

      {/* Copy Dialog */}
      {isCopyOpen && (
        <MoveDialog
          title={`Copy Folder: ${name}`}
          currentPath={path}
          open={isCopyOpen}
          onOpenChange={setIsCopyOpen}
          onMove={handleCopy}
          isLoading={isLoading}
          excludePath={path}
          type='folder'
          actionLabel='Copy'
        />
      )}
    </div>
  )
}
