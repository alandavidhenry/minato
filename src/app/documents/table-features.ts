import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures
} from '@tanstack/react-table'

export const documentTableFeatures = tableFeatures({
  rowSelectionFeature,
  rowPaginationFeature,
  columnFilteringFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns,
  sortFns
})
