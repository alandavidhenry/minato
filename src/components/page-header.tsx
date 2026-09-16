import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  readonly title: ReactNode
  readonly description?: ReactNode
  // Buttons or filters aligned to the right of the title on wide viewports.
  readonly actions?: ReactNode
  readonly className?: string
}

/*
  The single page-title treatment. Supabase sizes page titles modestly — the
  section nav already says where you are — so this is text-xl, not the
  text-3xl font-bold that each page used to re-implement.
*/
export function PageHeader({
  title,
  description,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 pb-1',
        className
      )}
    >
      <div className='min-w-0 space-y-1'>
        <h1 className='truncate text-xl font-medium tracking-tight'>{title}</h1>
        {description && (
          <p className='text-sm text-muted-foreground'>{description}</p>
        )}
      </div>
      {actions && (
        <div className='flex shrink-0 items-center gap-2'>{actions}</div>
      )}
    </div>
  )
}
