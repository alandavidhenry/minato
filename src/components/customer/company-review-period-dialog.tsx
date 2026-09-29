'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ReviewPeriodSelect } from '@/components/review-period-select'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'

interface CompanyReviewPeriodDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const API = '/api/customer/admin/settings/review-period'

export function CompanyReviewPeriodDialog({
  open,
  onOpenChange
}: CompanyReviewPeriodDialogProps) {
  const [value, setValue] = useState<number | null>(null)
  const [effective, setEffective] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(API)
        if (!res.ok) return
        const data = await res.json()
        setValue(data.reviewPeriodMonths)
        setEffective(data.effective)
      } catch (error) {
        console.error('Error loading review period:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [open])

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewPeriodMonths: value })
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Default review period saved' })
      onOpenChange(false)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save the default review period.',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[440px]'>
        <DialogHeader>
          <DialogTitle>Default review period</DialogTitle>
          <DialogDescription>
            How often your company&apos;s templates are due for review by
            default. Existing templates keep their own period.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center gap-2 py-4 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading…
          </div>
        ) : (
          <div className='py-2'>
            <ReviewPeriodSelect
              id='company-review-period'
              label='Default for new templates'
              defaultLabel={
                effective !== null && value === null
                  ? `Organisation default (${effective} months)`
                  : 'Organisation default'
              }
              description='Applied when a template is created without choosing its own period.'
              value={value}
              onChange={setValue}
              disabled={isSaving}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
