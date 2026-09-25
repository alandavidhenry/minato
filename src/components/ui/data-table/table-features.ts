import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures
} from '@tanstack/react-table'

import type { CellData, RowData, TableFeatures } from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns
})

/* eslint-disable @typescript-eslint/no-unused-vars -- declaration merge requires matching arity, not usage */
declare module '@tanstack/react-table' {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData
  > {
    // Applied to both the <TableHead> and every <TableCell> in the column,
    // e.g. 'text-right' for an actions column.
    align?: 'left' | 'right' | 'center'
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
