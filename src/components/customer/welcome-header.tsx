'use client'

import { useSession } from 'next-auth/react'

interface WelcomeHeaderProps {
  readonly title: string
  readonly subtitle?: string
}

function firstName(name: string | null | undefined) {
  if (!name) return null
  return name.trim().split(/\s+/)[0]
}

// One-line orientation header for customer landing pages — who you are and
// a quick status summary, above the page's usual title.
export function WelcomeHeader({ title, subtitle }: WelcomeHeaderProps) {
  const { data: session } = useSession()
  const name = firstName(session?.user?.name)

  return (
    <div className='space-y-1'>
      <h1 className='text-3xl font-bold'>{title}</h1>
      <p className='text-sm text-muted-foreground'>
        {name ? `Welcome back, ${name}.` : 'Welcome back.'}
        {subtitle ? ` ${subtitle}` : ''}
      </p>
    </div>
  )
}
