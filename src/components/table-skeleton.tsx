import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

interface TableSkeletonProps {
  readonly columns: number
  readonly rows?: number
}

// Placeholder rows for a loading table, replacing the "Loading users..."
// colspan text rows that each table page wrote for itself.
export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton className='h-4 w-full max-w-[160px]' />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
