// Shared accessorFn helpers for DataTable columns whose sort key is a
// possibly-null ISO date string — nulls sort as "latest" (last ascending,
// first descending), matching the sort behaviour every page had before
// migrating onto DataTable.
export function nullableDateSortValue(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY
}
