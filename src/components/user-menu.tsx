'use client'

import { LogOut, User } from 'lucide-react'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

// Avatar-menu grouping account context (profile + sign out) in the top bar.
export function UserMenu() {
  const { data: session } = useSession()

  if (!session?.user) {
    return <Button onClick={() => signIn()}>Sign In</Button>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='rounded-full'
          aria-label='Account menu'
        >
          <span className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground'>
            {initials(session.user.name)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel className='truncate'>
          {session.user.name ?? 'Account'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href='/profile' className='flex items-center gap-2'>
            <User className='h-4 w-4' />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/' })}
          className='flex items-center gap-2 text-destructive focus:text-destructive'
        >
          <LogOut className='h-4 w-4' />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
