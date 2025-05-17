// src/components/move-modal.tsx
'use client'

import { Move } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

interface MoveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  isFolder?: boolean
  path: string
}

interface FolderOption {
  path: string
  label: string
}

interface FolderItem {
  name: string
  isFolder: boolean
  children?: FolderItem[]
}

export function MoveModal({
  open,
  onOpenChange,
  name,
  isFolder = false,
  path
}: MoveModalProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isMoving, setIsMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetFolder, setTargetFolder] = useState<string>('')
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Create indented label based on folder depth
  const createIndentedLabel = useCallback((path: string): string => {
    const depth = path.split('/').length - 1
    const name = path.split('/').pop() ?? path
    return `${'│ '.repeat(depth)}${name}`
  }, [])

  // Extract all folders function - memoized
  const getAllFolders = useCallback(
    (contents: FolderItem[], parentPath = ''): FolderOption[] => {
      const folderOptions: FolderOption[] = []

      for (const item of contents) {
        if (item.isFolder) {
          const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name
          const indentedLabel = createIndentedLabel(fullPath)

          folderOptions.push({
            path: fullPath,
            label: indentedLabel
          })

          // If item has children, add them recursively
          if (item.children && Array.isArray(item.children)) {
            folderOptions.push(...getAllFolders(item.children, fullPath))
          }
        }
      }

      return folderOptions
    },
    [createIndentedLabel]
  )

  // Filter out invalid target folders - memoized
  const filterValidTargets = useCallback(
    (folders: FolderOption[], currentPath: string): FolderOption[] => {
      return folders.filter((folder) => {
        // Cannot move to current path or its child paths
        return (
          folder.path !== currentPath &&
          !folder.path.startsWith(`${currentPath}/`)
        )
      })
    },
    []
  )

  // Fetch folders - now depends on getAllFolders and filterValidTargets
  const fetchFolders = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/folders/all')

      if (!response.ok) {
        throw new Error('Failed to fetch folders')
      }

      const data = await response.json()

      if (data.success && data.contents) {
        // Add root as an option with a non-empty value
        const folderOptions: FolderOption[] = [{ path: 'root', label: 'Root' }]

        // Extract folders from contents
        const allFolders = getAllFolders(data.contents)

        // Filter out the current folder and its children to prevent circular moves
        const filteredFolders = filterValidTargets(allFolders, path)

        folderOptions.push(...filteredFolders)
        setFolders(folderOptions)
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
      setError('Failed to load available folders')
    } finally {
      setIsLoading(false)
    }
  }, [path, getAllFolders, filterValidTargets])

  // Effect when dialog opens
  useEffect(() => {
    if (open) {
      setError(null)
      setIsMoving(false)
      setTargetFolder('')
      fetchFolders()
    }
  }, [open, fetchFolders])

  const handleMove = async () => {
    if (!session || isMoving) return
    setError(null)
    setIsMoving(true)

    try {
      // Only proceed if a target folder is selected
      if (!targetFolder) {
        setError('Please select a destination folder')
        setIsMoving(false)
        return
      }

      // Handle root folder specially - for moving to root, send empty string
      const actualTargetFolder = targetFolder === 'root' ? '' : targetFolder

      // For files, we need to ensure we're sending the correct source path
      // If the file is in a folder, the name should include the path
      const sourcePath = isFolder ? path : name

      // For the target, we just need the parent folder path
      const targetPath = actualTargetFolder

      let data
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10-second timeout

        const response = await fetch('/api/documents/move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sourcePath,
            targetPath,
            isFolder
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Try to parse the response body as JSON
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = { error: 'Invalid response format' }
        }

        if (!response.ok) {
          setError(
            data.error ?? `Operation failed with status: ${response.status}`
          )
          return
        }
      } catch (fetchError) {
        // Handle network errors or timeouts silently (no console logging)
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            setError('Request timed out. Please try again.')
          } else {
            setError(`Network error: ${fetchError.message}`)
          }
        } else {
          setError('Network error. Please check your connection and try again.')
        }
        return
      }

      toast({
        title: 'Item moved',
        description: data.message,
        duration: 3000
      })

      // Close the dialog
      onOpenChange(false)

      // Navigate to the target folder
      router.push(
        actualTargetFolder
          ? `/documents?path=${encodeURIComponent(actualTargetFolder)}`
          : '/documents'
      )
      router.refresh()
    } catch (error) {
      // Silent error handling - just set the error message without console.error
      setError(error instanceof Error ? error.message : 'Failed to move item')
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Move className='h-5 w-5' />
            Move {isFolder ? 'Folder' : 'File'}
          </DialogTitle>
          <DialogDescription>
            Select a destination folder to move {isFolder ? 'folder' : 'file'} "
            {name.split('/').pop() ?? name}".
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Select
              disabled={isLoading || isMoving}
              value={targetFolder}
              onValueChange={setTargetFolder}
            >
              <SelectTrigger className='w-full'>
                <SelectValue
                  placeholder={
                    isLoading
                      ? 'Loading folders...'
                      : 'Select destination folder'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.path} value={folder.path}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {error && <p className='text-destructive text-sm'>{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={isMoving || isLoading}
            className='gap-2'
          >
            {isMoving ? (
              <>
                <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'></span>
                Moving...
              </>
            ) : (
              <>
                <Move className='h-4 w-4' />
                Move
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
