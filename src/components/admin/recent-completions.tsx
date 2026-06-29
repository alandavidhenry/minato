'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface RecentCompletion {
  id: string
  signedAt: string
  signer: { id: string; displayName: string; email: string | null }
  assignment: {
    id: string
    template: { id: string; title: string }
    customerCompany: { id: string; name: string }
  }
}

const PLACEHOLDER_IDS = [
  'placeholder-a',
  'placeholder-b',
  'placeholder-c',
  'placeholder-d',
  'placeholder-e'
]

function formatRelativeTime(dateTimeString: string): string {
  const date = new Date(dateTimeString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  return date.toLocaleDateString()
}

export function RecentCompletions() {
  const [isLoading, setIsLoading] = useState(true)
  const [completions, setCompletions] = useState<RecentCompletion[]>([])

  useEffect(() => {
    async function fetchRecentCompletions() {
      try {
        setIsLoading(true)
        const response = await fetch('/api/admin/dashboard/completions?limit=5')
        if (response.ok) {
          const data = await response.json()
          setCompletions(data.completions)
        }
      } catch (error) {
        console.error('Error fetching recent completions:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchRecentCompletions()
  }, [])

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {PLACEHOLDER_IDS.map((id) => (
          <div key={id} className='flex items-center gap-2'>
            <div className='h-8 w-8 animate-pulse rounded-full bg-muted' />
            <div className='flex-1'>
              <div className='h-4 w-full animate-pulse rounded bg-muted' />
              <div className='mt-1 h-3 w-24 animate-pulse rounded bg-muted' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (completions.length === 0) {
    return <p className='text-muted-foreground'>No completions yet.</p>
  }

  return (
    <div className='space-y-3'>
      {completions.map((c) => (
        <div
          key={c.id}
          className='flex items-start gap-2 border-b pb-2 last:border-b-0'
        >
          <span className='mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30'>
            <CheckCircle2 className='h-4 w-4' />
          </span>
          <div className='flex-1'>
            <p className='text-sm'>
              <span className='font-semibold'>{c.signer.displayName}</span>{' '}
              signed{' '}
              <span className='font-medium'>{c.assignment.template.title}</span>
              <span className='text-muted-foreground'>
                {' '}
                — {c.assignment.customerCompany.name}
              </span>
            </p>
            <p className='text-xs text-muted-foreground'>
              {formatRelativeTime(c.signedAt)}
            </p>
          </div>
        </div>
      ))}
      <div className='text-right'>
        <Link
          href='/admin/completions'
          className='text-xs text-primary hover:underline'
        >
          View all completions →
        </Link>
      </div>
    </div>
  )
}
