'use client'

import {
  ColumnDef,
  flexRender,
  RowData,
  SortingState,
  useTable
} from '@tanstack/react-table'
import { useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/table-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { SortArrows } from './sort-arrows'
import { dataTableFeatures } from './table-features'

function alignClassName(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return undefined
}

interface DataTableProps<TData extends RowData> {
  readonly columns: ColumnDef<typeof dataTableFeatures, TData>[]
  readonly data: TData[]
  readonly getRowId?: (row: TData, index: number) => string
  readonly isLoading?: boolean
  readonly emptyTitle?: string
  readonly emptyDescription?: string
  readonly rowClassName?: (row: TData) => string | undefined
  // Uncontrolled by default (internal useState); pass both to control sort
  // state from the parent, e.g. to sync it with the URL.
  readonly sorting?: SortingState
  readonly onSortingChange?: (sorting: SortingState) => void
  // Override the default bordered card wrapper, e.g. to '' when nesting a
  // DataTable inside a container that already draws its own border.
  readonly wrapperClassName?: string
}

// The one sortable, loading- and empty-state-aware table, replacing the ~14
// pages that each hand-rolled <Table>/<TableRow> markup, and in several cases
// a manual SortArrows + click-to-sort header implementation.
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  isLoading = false,
  emptyTitle = 'No results found',
  emptyDescription,
  rowClassName,
  sorting: controlledSorting,
  onSortingChange,
  wrapperClassName = 'rounded-md border'
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting
  const setSorting = onSortingChange ?? setInternalSorting

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    onSortingChange: (updater) => {
      setSorting(typeof updater === 'function' ? updater(sorting) : updater)
    },
    state: { sorting }
  })

  return (
    <div className={wrapperClassName}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const align = header.column.columnDef.meta?.align
                if (header.isPlaceholder) {
                  return <TableHead key={header.id} />
                }
                return (
                  <TableHead key={header.id} className={alignClassName(align)}>
                    {header.column.getCanSort() ? (
                      <button
                        type='button'
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-foreground',
                          align === 'right' && 'float-right'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        <SortArrows
                          sorted={!!header.column.getIsSorted()}
                          direction={header.column.getIsSorted()}
                        />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton columns={columns.length} />
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className='p-0'>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={rowClassName?.(row.original)}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={alignClassName(
                      cell.column.columnDef.meta?.align
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
