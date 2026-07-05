'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PublishVersionDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly templateTitle: string
  readonly isSubmitting: boolean
  readonly onConfirm: (changeReason: string) => void
}

export function PublishVersionDialog({
  open,
  onOpenChange,
  templateTitle,
  isSubmitting,
  onConfirm
}: PublishVersionDialogProps) {
  const [changeReason, setChangeReason] = useState('')

  useEffect(() => {
    if (open) setChangeReason('')
  }, [open])

  function handleConfirm() {
    if (!changeReason.trim()) return
    onConfirm(changeReason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Publish New Version</DialogTitle>
          <DialogDescription>
            Publishing a new version of &quot;{templateTitle}&quot; will create
            fresh assignment cycles for all currently assigned companies. Old
            completions remain as historical records.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-2 py-2'>
          <Label htmlFor='change-reason'>Reason for change</Label>
          <Textarea
            id='change-reason'
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder='e.g. New COSHH regulation April 2026'
            disabled={isSubmitting}
            rows={3}
          />
          <p className='text-xs text-muted-foreground'>
            Shown in the template&apos;s version history for auditors and
            company admins.
          </p>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleConfirm}
            disabled={isSubmitting || !changeReason.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Publishing...
              </>
            ) : (
              'Publish'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
