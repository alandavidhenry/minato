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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  computeReviewDueAt,
  isValidReviewPeriod,
  MAX_REVIEW_MONTHS,
  REVIEW_PERIOD_OPTIONS_MONTHS
} from '@/lib/review-dates'
import { ADMIN_ROLES } from '@/types/rbac'

interface AdminUser {
  id: string
  displayName: string
  role: string
}

interface ReviewSettingsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly templateTitle: string
  readonly reviewOwnerId: string | null
  readonly reviewDueAt: string | null
  readonly reviewPeriodMonths: number
  readonly lastReviewedAt: string | null
  readonly isSubmitting: boolean
  // Who can own the review: defaults to Simon's admins; the customer admin
  // portal passes its own users endpoint and role
  readonly usersEndpoint?: string
  readonly ownerRoles?: readonly string[]
  readonly noOwnerLabel?: string
  readonly noOwnerHint?: string
  readonly onSave: (values: {
    reviewOwnerId: string | null
    reviewDueAt: string
    reviewPeriodMonths: number
  }) => void
}

const NO_OWNER = 'none'

export function ReviewSettingsDialog({
  open,
  onOpenChange,
  templateTitle,
  reviewOwnerId,
  reviewDueAt,
  reviewPeriodMonths,
  lastReviewedAt,
  isSubmitting,
  usersEndpoint = '/api/admin/users',
  ownerRoles = ADMIN_ROLES,
  noOwnerLabel = 'No owner (all admins)',
  noOwnerHint = 'With no owner, every admin is reminded.',
  onSave
}: ReviewSettingsDialogProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [owner, setOwner] = useState(NO_OWNER)
  const [dueDate, setDueDate] = useState('')
  const [period, setPeriod] = useState('12')

  useEffect(() => {
    if (!open) return
    setOwner(reviewOwnerId ?? NO_OWNER)
    setDueDate(reviewDueAt ? reviewDueAt.slice(0, 10) : '')
    setPeriod(String(reviewPeriodMonths))

    async function fetchAdmins() {
      try {
        const res = await fetch(usersEndpoint)
        if (!res.ok) return
        const data = await res.json()
        setAdmins(
          (data.users as AdminUser[]).filter((u) =>
            (ownerRoles as readonly string[]).includes(u.role)
          )
        )
      } catch (error) {
        console.error('Error fetching admins:', error)
      }
    }
    fetchAdmins()
  }, [
    open,
    reviewOwnerId,
    reviewDueAt,
    reviewPeriodMonths,
    usersEndpoint,
    ownerRoles
  ])

  const periodMonths = Number(period)
  const periodValid = isValidReviewPeriod(periodMonths)

  // Changing the period re-derives the next date from the last review; the
  // date can still be adjusted by hand afterwards.
  function handlePeriodChange(value: string) {
    setPeriod(value)
    const months = Number(value)
    if (!isValidReviewPeriod(months)) return
    const base = lastReviewedAt ? new Date(lastReviewedAt) : new Date()
    setDueDate(computeReviewDueAt(base, months).toISOString().slice(0, 10))
  }

  function handleSave() {
    if (!dueDate || !periodValid) return
    onSave({
      reviewOwnerId: owner === NO_OWNER ? null : owner,
      reviewDueAt: new Date(`${dueDate}T00:00:00.000Z`).toISOString(),
      reviewPeriodMonths: periodMonths
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Review Settings</DialogTitle>
          <DialogDescription>
            Who is reminded, and when &quot;{templateTitle}&quot; is next due
            for review. {noOwnerHint}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-2'>
          <div className='grid gap-2'>
            <Label htmlFor='review-owner'>Review owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger id='review-owner'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OWNER}>{noOwnerLabel}</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='review-period'>Review every (months)</Label>
            <div className='flex gap-2'>
              {REVIEW_PERIOD_OPTIONS_MONTHS.map((m) => (
                <Button
                  key={m}
                  type='button'
                  size='sm'
                  variant={periodMonths === m ? 'default' : 'outline'}
                  onClick={() => handlePeriodChange(String(m))}
                >
                  {m}
                </Button>
              ))}
              <Input
                id='review-period'
                type='number'
                min={1}
                max={MAX_REVIEW_MONTHS}
                className='w-20'
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
              />
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='review-due'>Next review date</Label>
            <Input
              id='review-due'
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !dueDate || !periodValid}
          >
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
