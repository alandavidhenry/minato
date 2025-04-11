// src/app/documents/columns.tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'

import { FolderActions } from '@/components/folder-actions'
import { Checkbox } from '@/components/ui/checkbox'
import { SortArrows } from '@/components/ui/data-table/sort-arrows'

import {
  DocumentIconCell,
  DownloadCell,
  ShareCell,
  VersionCell,
  DeleteCell
} from './columns/index'
import { Document, TableMeta } from './types'

export const columns: ColumnDef<Document>[] = [
  // Selection column
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    enableSorting: false,
    enableHiding: false
  },
  // Document details columns
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Name
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    cell: ({ row }) => <DocumentIconCell item={row.original} />,
    enableSorting: true
  },
  {
    accessorKey: 'uploadedAt',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Modified
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    cell: ({ row }) => {
      // For folders, show the uploaded date or a fallback
      if (row.original.type === 'folder') {
        return row.original.updatedAt ?? row.getValue('uploadedAt') ?? '—'
      }
      // For files, show the uploaded date
      return row.getValue('uploadedAt')
    },
    enableSorting: true
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Type
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    cell: ({ row }) => {
      const type = row.getValue('type')
      // If it's a folder, display "Folder", otherwise display the file type
      return type === 'folder' ? 'Folder' : type
    },
    enableSorting: true
  },
  {
    accessorKey: 'size',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Size
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
    cell: ({ row }) => {
      // For folders, show a dash or empty string
      if (row.original.type === 'folder') {
        return '—'
      }
      // For files, show the size
      return row.getValue('size')
    },
    enableSorting: true,
    sortingFn: (rowA, rowB, columnId) => {
      // Custom sorting function to handle both folders and files
      // Folders always come first
      if (rowA.original.type === 'folder' && rowB.original.type !== 'folder') {
        return -1
      }
      if (rowA.original.type !== 'folder' && rowB.original.type === 'folder') {
        return 1
      }

      // If both are folders or both are files, use the existing sorting logic
      if (rowA.original.type !== 'folder' && rowB.original.type !== 'folder') {
        // Existing size sorting logic
        const getSizeInBytes = (sizeStr: string) => {
          const units: { [key: string]: number } = {
            Bytes: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024
          }

          const parts = sizeStr.split(' ')
          if (parts.length !== 2) return 0

          const value = parseFloat(parts[0])
          const unit = parts[1]

          return value * (units[unit] || 1)
        }

        const sizeA = getSizeInBytes(rowA.getValue(columnId))
        const sizeB = getSizeInBytes(rowB.getValue(columnId))

        return sizeA - sizeB
      }

      // If both are folders, sort by name
      return rowA.original.name.localeCompare(rowB.original.name)
    }
  },
  {
    id: 'version',
    header: 'Version',
    cell: ({ row }) => (
      <VersionCell
        name={row.getValue('name')}
        path={row.original.path}
        hasVersions={row.original.hasVersions}
        versionNumber={row.original.versionNumber}
        totalVersions={row.original.totalVersions}
      />
    ),
    enableSorting: false
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      // If it's a folder, show folder actions
      if (row.original.type === 'folder') {
        return (
          <FolderActions
            folder={row.original}
            onAction={() => {
              const meta = table.options.meta as TableMeta
              meta.onAction?.()
            }}
          />
        )
      }

      // For files, use the existing actions
      return (
        <div className='flex space-x-1'>
          <DownloadCell name={row.getValue('name')} path={row.original.path} />
          <ShareCell name={row.getValue('name')} path={row.original.path} />
          <DeleteCell name={row.getValue('name')} path={row.original.path} />
        </div>
      )
    },
    enableSorting: false
  }
]
