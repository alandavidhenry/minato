// src/app/documents/data-table.tsx
'use client'

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  RowSelectionState,
  getSortedRowModel,
  SortingState
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { DeleteConfirmationModal } from '@/components/delete-confirmation-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { useMediaQuery } from '@/hooks/use-media-query'

interface DataTableProps<TData, TValue> {
  readonly columns: ColumnDef<TData, TValue>[]
  readonly data: TData[]
  readonly folderPath?: string
  readonly onAction?: () => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  folderPath = '',
  onAction
}: DataTableProps<TData, TValue>) {
  const { data: session } = useSession()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Add sorting state
  const [sorting, setSorting] = useState<SortingState>([])

  // Use the media query hook
  const isDesktop = useMediaQuery('(min-width: 768px)')

  // Get the table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      rowSelection,
      sorting
    },
    meta: {
      onAction
    }
  })

  // Get selected row data
  const selectedRows = table.getSelectedRowModel().rows
  const selectedFilenames = selectedRows.map(
    (row) => (row.original as any).name
  )
  const hasSelectedRows = selectedRows.length > 0

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (!hasSelectedRows || !session) return
    setShowDeleteConfirmation(true)
  }

  // Confirm bulk delete
  const confirmBulkDelete = async () => {
    if (!hasSelectedRows || !session || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/documents/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          names: selectedFilenames,
          folderPath
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Bulk delete failed')
      }

      await response.json()

      toast({
        title: 'Documents deleted',
        description: `Successfully deleted ${selectedRows.length} document(s)`,
        duration: 3000
      })

      // Reset selection
      setRowSelection({})

      // Call onAction callback instead of reloading the page
      if (onAction) {
        onAction()
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete documents',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirmation(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* Selection toolbar */}
      {hasSelectedRows && (
        <div className='flex items-center justify-between bg-muted/50 p-2 rounded-md'>
          <div className='text-sm'>
            {selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'}{' '}
            selected
          </div>
          <Button
            variant='destructive'
            size='sm'
            onClick={handleBulkDelete}
            disabled={!session || isDeleting}
            className='gap-2'
          >
            <Trash2 className='h-4 w-4' />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border'>
        {isDesktop ? (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : (
                          <div
                            className={
                              header.column.getCanSort()
                                ? 'cursor-pointer select-none flex items-center gap-1'
                                : ''
                            }
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {{
                              asc: ' 🔼',
                              desc: ' 🔽'
                            }[header.column.getIsSorted() as string] ?? null}
                          </div>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className='h-24 text-center'
                  >
                    No documents found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          // Mobile card layout
          <div className='space-y-4 p-4'>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const nameCell = row
                  .getVisibleCells()
                  .find((cell) => cell.column.id === 'name')
                const versionCell = row
                  .getVisibleCells()
                  .find((cell) => cell.column.id === 'version')
                const actionsCell = row
                  .getVisibleCells()
                  .find((cell) => cell.column.id === 'actions')

                return (
                  <div
                    key={row.id}
                    className='p-4 border rounded-md space-y-2 bg-card'
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) =>
                            row.toggleSelected(!!value)
                          }
                          aria-label='Select row'
                        />
                        {/* Document name cell with icon */}
                        {nameCell &&
                          flexRender(
                            nameCell.column.columnDef.cell,
                            nameCell.getContext()
                          )}
                      </div>
                    </div>

                    <div className='grid grid-cols-2 gap-2 text-sm'>
                      <div>
                        <span className='text-muted-foreground'>Uploaded:</span>{' '}
                        {row.getValue('uploadedAt')}
                      </div>
                      <div>
                        <span className='text-muted-foreground'>Size:</span>{' '}
                        {row.getValue('size')}
                      </div>
                      <div>
                        <span className='text-muted-foreground'>Type:</span>{' '}
                        {row.getValue('type')}
                      </div>
                    </div>

                    <div className='flex justify-between items-center'>
                      {/* Version info */}
                      <div>
                        {versionCell &&
                          flexRender(
                            versionCell.column.columnDef.cell,
                            versionCell.getContext()
                          )}
                      </div>

                      {/* Actions */}
                      <div className='flex space-x-1'>
                        {actionsCell &&
                          flexRender(
                            actionsCell.column.columnDef.cell,
                            actionsCell.getContext()
                          )}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className='text-center p-4 border rounded-md'>
                No documents found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          fileNames={selectedFilenames}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowDeleteConfirmation(false)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
