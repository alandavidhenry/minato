// src/components/move-dialog.tsx
'use client'

import { ChevronRight, Folder, Home, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

interface Folder {
  id: string
  name: string
  path: string
}

interface MoveDialogProps {
  readonly title: string
  readonly currentPath: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onMove: (targetPath: string) => void
  readonly isLoading: boolean
  readonly excludePath?: string // Path to exclude from the folder list (to prevent moving into its own subfolder)
  readonly type?: 'file' | 'folder'
  readonly actionLabel?: string
}

export function MoveDialog({
  title,
  currentPath, // eslint-disable-line @typescript-eslint/no-unused-vars
  open,
  onOpenChange,
  onMove,
  isLoading,
  excludePath,
  type = 'file', // eslint-disable-line @typescript-eslint/no-unused-vars
  actionLabel = 'Move'
}: MoveDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentViewPath, setCurrentViewPath] = useState('')
  const [selectedPath, setSelectedPath] = useState('')
  const [isLoadingFolders, setIsLoadingFolders] = useState(true)

  // Parse the current view path into segments for breadcrumb
  const pathSegments = currentViewPath ? currentViewPath.split('/') : []

  // Fetch folders when the dialog opens or path changes
  useEffect(() => {
    fetchFolders(currentViewPath)
  }, [currentViewPath, open])

  // Fetch folders from the API
  const fetchFolders = async (path: string) => {
    setIsLoadingFolders(true)

    try {
      const response = await fetch(
        `/api/folders?path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch folders')
      }

      const data = await response.json()

      // Filter only folders from the contents
      const foldersList = data.contents.filter(
        (item: any) =>
          item.type === 'folder' &&
          // Exclude the specified path and any of its subfolders
          (excludePath ? !item.path.startsWith(excludePath) : true)
      )

      setFolders(foldersList)
    } catch (error) {
      console.error('Error fetching folders:', error)
      toast({
        title: 'Error',
        description: 'Failed to load folders',
        variant: 'destructive'
      })
    } finally {
      setIsLoadingFolders(false)
    }
  }

  // Navigate to a folder
  const navigateToFolder = (path: string) => {
    setCurrentViewPath(path)
  }

  // Select a folder as the target
  const selectFolder = (path: string) => {
    setSelectedPath(path)
  }

  // Handle the move action
  const handleMove = () => {
    // If no folder is selected, move to root
    onMove(selectedPath)
  }

  // Build the breadcrumb navigation
  const breadcrumbItems = [
    { name: 'Root', path: '' },
    ...pathSegments.map((segment, index) => {
      const path = pathSegments.slice(0, index + 1).join('/')
      return { name: segment, path }
    })
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className='py-4'>
          <div className='flex items-center justify-between mb-2'>
            {/* Breadcrumb for folder navigation */}
            <div className='flex items-center text-sm'>
              {breadcrumbItems.map((item, index) => (
                <div key={item.path} className='flex items-center'>
                  <button
                    className='hover:underline flex items-center'
                    onClick={() => navigateToFolder(item.path)}
                  >
                    {index === 0 ? (
                      <>
                        <Home className='h-3 w-3 mr-1' />
                        {item.name}
                      </>
                    ) : (
                      item.name
                    )}
                  </button>
                  {index < breadcrumbItems.length - 1 && (
                    <ChevronRight className='h-3 w-3 mx-1' />
                  )}
                </div>
              ))}
            </div>

            <Button
              variant='ghost'
              size='sm'
              onClick={() => fetchFolders(currentViewPath)}
              disabled={isLoadingFolders}
            >
              <RefreshCw className='h-3 w-3' />
            </Button>
          </div>

          {/* Target selection */}
          <div className='border rounded-md h-48 overflow-y-auto p-1'>
            {/* Root folder option */}
            <div
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                selectedPath === '' ? 'bg-accent' : ''
              }`}
              onClick={() => selectFolder('')}
            >
              <Home className='h-4 w-4' />
              <span>Root</span>
            </div>

            {/* Loading state */}
            {isLoadingFolders ? (
              <div className='flex justify-center items-center h-24'>
                <RefreshCw className='h-5 w-5 animate-spin' />
              </div>
            ) : folders.length === 0 ? (
              <div className='flex justify-center items-center h-24 text-muted-foreground'>
                No folders found
              </div>
            ) : (
              // Folder list
              folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent ${
                    selectedPath === folder.path ? 'bg-accent' : ''
                  }`}
                  onClick={() => selectFolder(folder.path)}
                  onDoubleClick={() => navigateToFolder(folder.path)}
                >
                  <div className='flex items-center gap-2'>
                    <Folder className='h-4 w-4 text-blue-500' />
                    <span>{folder.name}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className='mt-2 text-sm'>
            <div>
              Selected destination: <strong>{selectedPath || 'Root'}</strong>
            </div>
            <div className='text-muted-foreground text-xs mt-1'>
              Double-click a folder to navigate inside it
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isLoading}>
            {isLoading ? `${actionLabel}ing...` : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
