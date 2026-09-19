'use client'

import { useSession } from 'next-auth/react'

import { PageHeader } from '@/components/page-header'

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
    <PageHeader
      title={title}
      description={`${name ? `Welcome back, ${name}.` : 'Welcome back.'}${
        subtitle ? ` ${subtitle}` : ''
      }`}
    />
  )
}
