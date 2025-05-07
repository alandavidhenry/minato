// src/app/documents/components/cell-components/RenameCell.tsx
'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { RenameDialog } from '@/components/rename-dialog'
import { Button } from '@/components/ui/button'

interface RenameCellProps {
  readonly name: string
  readonly isFolder?: boolean
  readonly path?: string
}

export function RenameCell({
  name,
  isFolder = false,
  path = ''
}: RenameCellProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        onClick={() => setDialogOpen(true)}
        className='hover:text-primary'
        title='Rename'
      >
        <Pencil className='h-4 w-4' />
      </Button>

      <RenameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        name={name}
        isFolder={isFolder}
        path={path || name}
      />
    </>
  )
}
