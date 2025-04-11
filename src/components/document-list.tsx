// src/components/document-list.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

import { columns } from '@/app/documents/columns'
import { DataTable } from '@/app/documents/data-table'
import { FolderNavigator } from '@/components/folder-navigator'
import { toast } from '@/components/ui/use-toast'

interface Folder {
  id: string
  name: string
  path: string
  type: 'folder'
}

export function DocumentList() {
  const searchParams = useSearchParams()
  const folderPath = searchParams.get('path') ?? ''

  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch folder contents when path changes
  useEffect(() => {
    fetchFolderContents()
  }, [folderPath])

  // Fetch folder contents
  const fetchFolderContents = async () => {
    setIsLoading(true)

    try {
      // Fetch folder contents
      const response = await fetch(
        `/api/folders?path=${encodeURIComponent(folderPath)}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch folder contents')
      }

      const data = await response.json()

      // Separate folders and files
      const foldersList = data.contents.filter(
        (item: any) => item.type === 'folder'
      )
      const filesList = data.contents.filter(
        (item: any) => item.type === 'file'
      )

      setFolders(foldersList)
      setFiles(filesList)
    } catch (error) {
      console.error('Error fetching folder contents:', error)
      toast({
        title: 'Error',
        description: 'Failed to load folder contents',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Folder navigation with upload button moved to right */}
      <FolderNavigator onRefresh={fetchFolderContents} />

      {/* Combined folders and files section */}
      <div>
        <h3 className='text-lg font-semibold mb-2'>Contents</h3>
        {isLoading ? (
          <div className='flex justify-center items-center h-32'>
            <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={[...folders, ...files]}
            folderPath={folderPath}
            onAction={fetchFolderContents}
          />
        )}
      </div>
    </div>
  )
}
