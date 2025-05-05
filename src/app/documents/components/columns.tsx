// src/app/documents/columns.tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'

import { DeleteCell } from './cell-components/DeleteCell'
import { DocumentNameCell } from './cell-components/DocumentNameCell'
import { DownloadCell } from './cell-components/DownloadCell'
import { ShareCell } from './cell-components/ShareCell'
import { VersionCell } from './cell-components/VersionCell'
import { sortBySize } from './helpers/sort-helper'

import { Document } from '@/app/documents/types/document'
import { Checkbox } from '@/components/ui/checkbox'
import { SortArrows } from '@/components/ui/data-table/sort-arrows'

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
        disabled={false}
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
    cell: ({ row }) => (
      <DocumentNameCell
        name={row.getValue('name')}
        type={row.getValue('type')}
        hasVersions={row.original.hasVersions}
        versionNumber={row.original.versionNumber}
        totalVersions={row.original.totalVersions}
        originalName={row.original.originalName}
        isFolder={row.original.isFolder}
        path={row.original.path}
      />
    ),
    enableSorting: true
  },
  {
    accessorKey: 'uploadedAt',
    header: ({ column }) => (
      <div className='flex items-center cursor-pointer'>
        Upload Date
        <SortArrows
          sorted={!!column.getIsSorted()}
          direction={column.getIsSorted() || false}
        />
      </div>
    ),
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
    enableSorting: true,
    sortingFn: sortBySize
  },
  {
    id: 'version',
    header: 'Version',
    cell: ({ row }) => {
      // Don't show version info for folders
      if (row.original.isFolder) {
        return null
      }

      return (
        <VersionCell
          name={row.getValue('name')}
          hasVersions={row.original.hasVersions}
          versionNumber={row.original.versionNumber}
          totalVersions={row.original.totalVersions}
        />
      )
    },
    enableSorting: false
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      // Don't show actions for folders
      if (row.original.isFolder) {
        return null
      }

      return (
        <div className='flex space-x-1'>
          <DownloadCell name={row.getValue('name')} />
          <ShareCell name={row.getValue('name')} />
          <DeleteCell name={row.getValue('name')} />
        </div>
      )
    },
    enableSorting: false
  }
]
