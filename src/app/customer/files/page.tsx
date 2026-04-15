// src/app/customer/files/page.tsx
'use client'

import { ChevronRight, Download, Folder, File } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

interface FileItem {
  name: string
  isFolder: boolean
  size?: string
  type?: string
  uploadedAt?: string
}

export default function CustomerFilesPage() {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchFiles()
  }, [currentPath])

  async function fetchFiles() {
    setIsLoading(true)
    try {
      const params = currentPath
        ? `?path=${encodeURIComponent(currentPath)}`
        : ''
      const res = await fetch(`/api/customer/files${params}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to load files')
      }

      const data = await res.json()
      setItems(data.items)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load files.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownload(fileName: string) {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName
    setDownloading(filePath)
    try {
      const res = await fetch(
        `/api/customer/files/download?path=${encodeURIComponent(filePath)}`
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to get download link')
      }

      const { url } = await res.json()
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download file.',
        variant: 'destructive'
      })
    } finally {
      setDownloading(null)
    }
  }

  function navigateInto(folderName: string) {
    setCurrentPath((prev) => (prev ? `${prev}/${folderName}` : folderName))
  }

  function navigateTo(path: string) {
    setCurrentPath(path)
  }

  // Build breadcrumb segments from currentPath
  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const folders = items.filter((i) => i.isFolder)
  const files = items.filter((i) => !i.isFolder)

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>My Files</h1>

      {/* Breadcrumb */}
      <nav className='flex items-center gap-1 text-sm text-muted-foreground'>
        <button
          onClick={() => navigateTo('')}
          className='hover:text-foreground transition-colors'
        >
          Root
        </button>
        {breadcrumbs.map((segment, index) => {
          const path = breadcrumbs.slice(0, index + 1).join('/')
          const isLast = index === breadcrumbs.length - 1
          return (
            <span key={path} className='flex items-center gap-1'>
              <ChevronRight className='h-4 w-4' />
              {isLast ? (
                <span className='text-foreground font-medium'>{segment}</span>
              ) : (
                <button
                  onClick={() => navigateTo(path)}
                  className='hover:text-foreground transition-colors'
                >
                  {segment}
                </button>
              )}
            </span>
          )
        })}
      </nav>

      {isLoading ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>Loading files...</p>
        </div>
      ) : items.length === 0 ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>
            {currentPath ? 'This folder is empty.' : 'No files available yet.'}
          </p>
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow
                  key={folder.name}
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => navigateInto(folder.name)}
                >
                  <TableCell className='font-medium'>
                    <span className='flex items-center gap-2'>
                      <Folder className='h-4 w-4 text-muted-foreground' />
                      {folder.name}
                    </span>
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {files.map((file) => {
                const filePath = currentPath
                  ? `${currentPath}/${file.name}`
                  : file.name
                return (
                  <TableRow key={file.name}>
                    <TableCell className='font-medium'>
                      <span className='flex items-center gap-2'>
                        <File className='h-4 w-4 text-muted-foreground' />
                        {file.name}
                      </span>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {file.size ?? '—'}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {file.uploadedAt ?? '—'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={downloading === filePath}
                        onClick={() => handleDownload(file.name)}
                      >
                        <Download className='mr-1 h-3 w-3' />
                        {downloading === filePath ? 'Preparing...' : 'Download'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
