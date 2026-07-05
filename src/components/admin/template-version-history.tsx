'use client'

import { useEffect, useState } from 'react'

import { VersionDiffView } from '@/components/admin/version-diff-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { diffTemplateSnapshots } from '@/lib/template-version-diff'
import type { TemplateVersionHistoryEntry } from '@/types/template-version-history'

interface TemplateVersionHistoryProps {
  readonly templateId: string
  readonly active: boolean
}

export function TemplateVersionHistory({
  templateId,
  active
}: TemplateVersionHistoryProps) {
  const [entries, setEntries] = useState<TemplateVersionHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareBefore, setCompareBefore] = useState('')
  const [compareAfter, setCompareAfter] = useState('')

  useEffect(() => {
    if (!active || hasFetched) return
    setHasFetched(true)

    async function fetchHistory() {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/admin/templates/${templateId}/version-history`
        )
        if (!response.ok) throw new Error('Failed to load version history')
        const data = await response.json()
        const fetchedEntries: TemplateVersionHistoryEntry[] = data.entries
        setEntries(fetchedEntries)
        if (fetchedEntries.length >= 2) {
          setCompareAfter(String(fetchedEntries[0].version))
          setCompareBefore(String(fetchedEntries[1].version))
        }
      } catch {
        setEntries([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [active, hasFetched, templateId])

  if (isLoading) {
    return (
      <p className='text-sm text-muted-foreground'>
        Loading version history...
      </p>
    )
  }

  if (hasFetched && entries.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        No version history available for this template.
      </p>
    )
  }

  const beforeEntry = entries.find((e) => String(e.version) === compareBefore)
  const afterEntry = entries.find((e) => String(e.version) === compareAfter)
  const diff =
    beforeEntry && afterEntry
      ? diffTemplateSnapshots(beforeEntry.snapshot, afterEntry.snapshot)
      : null

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        {entries.map((entry) => (
          <div key={entry.id} className='rounded-md border p-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={entry.isCurrent ? 'default' : 'secondary'}>
                  v{entry.version}
                </Badge>
                {entry.isCurrent && (
                  <span className='text-xs text-muted-foreground'>Current</span>
                )}
                <span className='text-xs text-muted-foreground'>
                  {new Date(entry.publishedAt).toLocaleDateString()}
                </span>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
              >
                {expandedId === entry.id ? 'Hide' : 'View'}
              </Button>
            </div>

            <p className='mt-2 text-sm'>
              <span className='text-muted-foreground'>By: </span>
              {entry.publishedByName ?? '—'}
            </p>
            <p className='text-sm'>
              <span className='text-muted-foreground'>Reason: </span>
              {entry.changeReason ?? '—'}
            </p>

            {expandedId === entry.id && (
              <div className='mt-3 space-y-1 border-t pt-3 text-sm'>
                <p className='font-medium'>{entry.snapshot.title}</p>
                {entry.snapshot.description && (
                  <p className='text-muted-foreground'>
                    {entry.snapshot.description}
                  </p>
                )}
                <p className='text-muted-foreground'>
                  {(entry.snapshot.formSchema ?? []).length} form field
                  {(entry.snapshot.formSchema ?? []).length === 1
                    ? ''
                    : 's'}, {(entry.snapshot.questions ?? []).length}{' '}
                  comprehension question
                  {(entry.snapshot.questions ?? []).length === 1 ? '' : 's'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {entries.length >= 2 && (
        <div className='space-y-3 border-t pt-4'>
          <p className='text-sm font-medium'>Compare versions</p>
          <div className='flex flex-wrap items-center gap-2'>
            <Select value={compareBefore} onValueChange={setCompareBefore}>
              <SelectTrigger className='w-24'>
                <SelectValue placeholder='From' />
              </SelectTrigger>
              <SelectContent>
                {entries.map((e) => (
                  <SelectItem key={e.id} value={String(e.version)}>
                    v{e.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className='text-muted-foreground'>vs</span>
            <Select value={compareAfter} onValueChange={setCompareAfter}>
              <SelectTrigger className='w-24'>
                <SelectValue placeholder='To' />
              </SelectTrigger>
              <SelectContent>
                {entries.map((e) => (
                  <SelectItem key={e.id} value={String(e.version)}>
                    v{e.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {diff && <VersionDiffView diff={diff} />}
        </div>
      )}
    </div>
  )
}
