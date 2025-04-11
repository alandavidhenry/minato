// src/components/folder-navigator.tsx
'use client'

import {
  ChevronRight,
  ChevronUp,
  Folder,
  Home,
  Plus,
  RefreshCw
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { DragDropUploader } from '@/components/drag-drop-uploader'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
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

interface FolderNavigatorProps {
  readonly onRefresh: () => void
}

export function FolderNavigator({ onRefresh }: FolderNavigatorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPath = searchParams.get('path') ?? ''

  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Parse the current path into segments for breadcrumb navigation
  const pathSegments = currentPath ? currentPath.split('/') : []

  // Create the path links for the breadcrumb
  const breadcrumbItems = [
    { name: 'Home', path: '' },
    ...pathSegments.map((segment, index) => {
      // Build cumulative path for each segment
      const path = pathSegments.slice(0, index + 1).join('/')
      return { name: segment, path }
    })
  ]

  // Navigate to a specific folder
  const navigateToFolder = (path: string) => {
    if (path) {
      router.push(`/documents?path=${encodeURIComponent(path)}`)
    } else {
      router.push('/documents')
    }
  }

  // Go up one folder level
  const navigateUp = () => {
    if (!currentPath) return // Already at root

    const segments = currentPath.split('/')
    segments.pop() // Remove the last segment
    const parentPath = segments.join('/')

    navigateToFolder(parentPath)
  }

  // Handle create folder submit
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newFolderName.trim()) {
      toast({
        title: 'Invalid folder name',
        description: 'Please enter a valid folder name',
        variant: 'destructive'
      })
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentPath: currentPath
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create folder')
      }

      // Successfully created folder
      toast({
        title: 'Success',
        description: `Folder "${newFolderName}" created successfully`
      })

      // Reset form and close dialog
      setNewFolderName('')
      setIsCreateFolderOpen(false)

      // Refresh the document list
      onRefresh()
    } catch (error) {
      console.error('Error creating folder:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create folder',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className='mb-4'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2'>
        {/* Breadcrumb navigation */}
        <div className='flex items-center space-x-2'>
          {/* Up folder button */}
          <Button
            variant='outline'
            size='sm'
            onClick={navigateUp}
            disabled={!currentPath}
            className='gap-1'
            title='Go up one level'
          >
            <ChevronUp className='h-4 w-4' />
            Up
          </Button>

          <Breadcrumb className='mb-2 sm:mb-0'>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => (
                <BreadcrumbItem key={index}>
                  {index === 0 ? (
                    <BreadcrumbLink
                      href='#'
                      onClick={(e: any) => {
                        e.preventDefault()
                        navigateToFolder('')
                      }}
                      className='flex items-center'
                    >
                      <Home className='h-4 w-4 mr-1' />
                      Root
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbLink
                      href='#'
                      onClick={(e: any) => {
                        e.preventDefault()
                        navigateToFolder(item.path)
                      }}
                    >
                      {item.name}
                    </BreadcrumbLink>
                  )}
                  {index < breadcrumbItems.length - 1 && (
                    <BreadcrumbSeparator>
                      <ChevronRight className='h-4 w-4' />
                    </BreadcrumbSeparator>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={onRefresh}
            className='gap-1'
          >
            <RefreshCw className='h-4 w-4' />
            Refresh
          </Button>

          <Button
            size='sm'
            onClick={() => setIsCreateFolderOpen(true)}
            className='gap-1'
          >
            <Plus className='h-4 w-4' />
            <Folder className='h-4 w-4' />
            New Folder
          </Button>

          {/* Upload button moved to the right */}
          <DragDropUploader
            folderPath={currentPath}
            onUploadComplete={onRefresh}
          />
        </div>
      </div>

      {/* Path display */}
      <div className='text-sm text-muted-foreground mb-2'>
        Current location: {currentPath || 'Root'}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <form onSubmit={handleCreateFolder}>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>

            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='folderName'>Folder Name</Label>
                <Input
                  id='folderName'
                  placeholder='Enter folder name'
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className='text-sm text-muted-foreground'>
                This folder will be created in: {currentPath || 'Root'}
              </div>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsCreateFolderOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={isCreating || !newFolderName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Folder'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
