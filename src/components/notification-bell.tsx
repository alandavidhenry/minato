'use client'

import { AlertTriangle, Bell } from 'lucide-react'
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

  useEffect(() => {
    if (!isAdmin && !isCustomerAdmin) return

    let cancelled = false

    async function fetchCount() {
      try {
        if (isAdmin) {
          const res = await fetch('/api/admin/dashboard/stats')
          if (!res.ok) return
          const data = await res.json()
          if (!cancelled) setOverdueCount(data.overdue ?? 0)
        } else {
          const res = await fetch('/api/customer/admin/completions')
          if (!res.ok) return
          const data: { groups: CompletionGroup[] } = await res.json()
          if (!cancelled) {
            setOverdueCount(data.groups.filter((g) => g.isOverdue).length)
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative'
          aria-label='Overdue completions'
        >
          <Bell className='h-5 w-5' />
          {overdueCount > 0 && (
            <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white'>
              {overdueCount > 99 ? '99+' : overdueCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuLabel>Overdue completions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={href} className='flex items-center gap-2'>
            <AlertTriangle className='h-4 w-4 text-red-500' />
            {overdueCount > 0
              ? `${overdueCount} assignment${overdueCount === 1 ? '' : 's'} overdue`
              : 'No overdue completions'}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
