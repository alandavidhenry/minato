'use client'

import { ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import type { ReviewStatus } from '@/lib/review-dates'

interface DueTemplate {
  id: string
  title: string
  reviewDueAt: string
  status: ReviewStatus
}

// Summary of the company's own templates needing review; renders nothing when
// there are none (or while loading / on error), so it never adds clutter.
export function ReviewDueCard() {
  const [templates, setTemplates] = useState<DueTemplate[]>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/customer/admin/templates/review-due')
        if (!res.ok) return
        const data = await res.json()
        setTemplates(data.templates)
      } catch {
        // Non-critical summary — leave hidden
      }
    }
    load()
  }, [])

  if (templates.length === 0) return null

  return (
    <Link
      href='/customer/admin/templates'
      className='block rounded-md border p-4 transition-colors hover:bg-muted/50'
    >
      <div className='flex items-center gap-2 text-sm font-medium'>
        <ClipboardCheck className='h-4 w-4 text-warning' />
        {templates.length} template{templates.length === 1 ? '' : 's'} due for
        review
      </div>
      <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
        {templates.slice(0, 5).map((t) => (
          <li key={t.id} className='flex items-center gap-2'>
            <span>{t.title}</span>
            <span>{new Date(t.reviewDueAt).toLocaleDateString('en-GB')}</span>
            <Badge
              variant={t.status === 'overdue' ? 'destructive' : 'secondary'}
              className='text-xs'
            >
              {t.status === 'overdue' ? 'Overdue' : 'Due soon'}
            </Badge>
          </li>
        ))}
      </ul>
    </Link>
  )
}
