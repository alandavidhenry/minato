'use client'

import { AlertTriangle, Bell, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useRBAC } from '@/components/providers/rbac-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { UserRole } from '@/types/rbac'

const POLL_INTERVAL_MS = 5 * 60 * 1000

interface CompletionGroup {
  isOverdue: boolean
}

// Surfaces the reminders/overdue-completions system in the shell — relevant
// to the roles responsible for chasing outstanding sign-offs (tenant admin,
// customer admin), not individual customer users completing their own forms.
export function NotificationBell() {
  const { isAdmin, hasRole } = useRBAC()
  const isCustomerAdmin = hasRole(UserRole.CUSTOMER_ADMIN)
  const [overdueCount, setOverdueCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    if (!isAdmin && !isCustomerAdmin) return

    let cancelled = false

    async function fetchCount() {
      try {
        if (isAdmin) {
          const res = await fetch('/api/admin/dashboard/stats')
          if (!res.ok) return
          const data = await res.json()
          if (!cancelled) {
            setOverdueCount(data.overdue ?? 0)
            setReviewCount(data.templatesDueForReview ?? 0)
          }
        } else {
          const [res, reviewRes] = await Promise.all([
            fetch('/api/customer/admin/completions'),
            fetch('/api/customer/admin/templates/review-due')
          ])
          if (res.ok) {
            const data: { groups: CompletionGroup[] } = await res.json()
            if (!cancelled) {
              setOverdueCount(data.groups.filter((g) => g.isOverdue).length)
            }
          }
          if (reviewRes.ok) {
            const data: { count: number } = await reviewRes.json()
            if (!cancelled) setReviewCount(data.count)
          }
        }
      } catch {
        // The bell is a convenience indicator, not a critical path — a
        // failed poll just leaves the previous count showing.
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isAdmin, isCustomerAdmin])

  if (!isAdmin && !isCustomerAdmin) return null

  const href = isAdmin
    ? '/admin/completions/outstanding?overdueOnly=true'
    : '/customer/admin/completions'
  const reviewHref = isAdmin ? '/admin/templates' : '/customer/admin/templates'
  const totalCount = overdueCount + reviewCount

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative'
          aria-label='Notifications'
        >
          <Bell className='h-5 w-5' />
          {totalCount > 0 && (
            <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground'>
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={href} className='flex items-center gap-2'>
            <AlertTriangle className='h-4 w-4 text-destructive' />
            {overdueCount > 0
              ? `${overdueCount} assignment${overdueCount === 1 ? '' : 's'} overdue`
              : 'No overdue completions'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={reviewHref} className='flex items-center gap-2'>
            <ClipboardCheck className='h-4 w-4 text-warning' />
            {reviewCount > 0
              ? `${reviewCount} template${reviewCount === 1 ? '' : 's'} due for review`
              : 'No templates due for review'}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
