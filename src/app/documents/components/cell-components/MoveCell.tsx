// src/app/documents/components/cell-components/MoveCell.tsx
'use client'

import { Move } from 'lucide-react'
import { useState } from 'react'

import { MoveModal } from '@/components/move-modal'
import { Button } from '@/components/ui/button'

interface MoveCellProps {
  readonly name: string
  readonly isFolder?: boolean
  readonly path?: string
}

export function MoveCell({ name, isFolder = false, path = '' }: MoveCellProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  // For folders, ensure we use the path
  const displayPath = isFolder ? path : name

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        onClick={() => setDialogOpen(true)}
        className='hover:text-primary'
        title='Move'
      >
        <Move className='h-4 w-4' />
      </Button>

      <MoveModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        name={name}
        isFolder={isFolder}
        path={displayPath}
      />
    </>
  )
}
