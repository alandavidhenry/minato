// src/components/folder-actions.tsx
'use client'

import { Copy, Edit, MoreHorizontal, MoveIcon, Trash2 } from 'lucide-react'
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

interface FolderActionsProps {
  readonly folder: {
    id: string
    name: string
    path?: string
    type: string
  }
  readonly onAction: () => void
}

export function FolderActions({ folder, onAction }: FolderActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isMoveOpen, setIsMoveOpen] = useState(false)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
  const [newName, setNewName] = useState(folder.name)
  const [isLoading, setIsLoading] = useState(false)

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    setIsRenameOpen(true)
  }

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    setIsMoveOpen(true)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    setIsCopyOpen(true)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
    setIsDeleteOpen(true)
  }

  // Handle rename folder submit
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newName.trim() || newName === folder.name) {
      setIsRenameOpen(false)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
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
      onAction()
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
  const handleDeleteConfirm = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete folder')
      }

      // Successfully deleted
      toast({
        title: 'Success',
        description: `Folder "${folder.name}" deleted successfully`
      })

      // Close dialog and notify parent
      setIsDeleteOpen(false)
      onAction()
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
  const handleMoveConfirm = async (targetPath: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${folder.id}/move`, {
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
        description: `Folder "${folder.name}" moved successfully`
      })

      // Close dialog and notify parent
      setIsMoveOpen(false)
      onAction()
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
  const handleCopyConfirm = async (targetPath: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/folders/${folder.id}/move`, {
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
        description: `Folder "${folder.name}" copied successfully`
      })

      // Close dialog and notify parent
      setIsCopyOpen(false)
      onAction()
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
    <>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon'>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={handleRename}>
              <Edit className='h-4 w-4 mr-2' />
              Rename
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleMove}>
              <MoveIcon className='h-4 w-4 mr-2' />
              Move
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleCopy}>
              <Copy className='h-4 w-4 mr-2' />
              Copy
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleDelete}
              className='text-destructive focus:text-destructive'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRenameSubmit}>
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
                disabled={
                  isLoading || !newName.trim() || newName === folder.name
                }
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
              <strong>{folder.name}</strong>&quot;?
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
              onClick={handleDeleteConfirm}
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
          title={`Move Folder: ${folder.name}`}
          currentPath={folder.path ?? ''}
          open={isMoveOpen}
          onOpenChange={setIsMoveOpen}
          onMove={handleMoveConfirm}
          isLoading={isLoading}
          excludePath={folder.path}
          type='folder'
        />
      )}

      {/* Copy Dialog */}
      {isCopyOpen && (
        <MoveDialog
          title={`Copy Folder: ${folder.name}`}
          currentPath={folder.path ?? ''}
          open={isCopyOpen}
          onOpenChange={setIsCopyOpen}
          onMove={handleCopyConfirm}
          isLoading={isLoading}
          excludePath={folder.path}
          type='folder'
          actionLabel='Copy'
        />
      )}
    </>
  )
}
