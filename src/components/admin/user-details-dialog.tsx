'use client'

import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

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
import { toast } from '@/components/ui/use-toast'

interface User {
  id: string
  displayName: string
  email: string | null
  role: string
  jobRole?: string | null
  lineManagerId?: string | null
  customerCompanyId?: string | null
  createdDateTime?: string
}

interface CompanyUser {
  id: string
  displayName: string
  email: string | null
}

interface UserDetailsDialogProps {
  readonly user: User
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onUserUpdated: () => void
}

const CUSTOMER_ROLES = ['Customer Admin', 'Customer User']

export function UserDetailsDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated
}: UserDetailsDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [formData, setFormData] = useState({
    displayName: user.displayName,
    jobRole: user.jobRole ?? '',
    lineManagerId: user.lineManagerId ?? ''
  })

  const isCustomerRole = CUSTOMER_ROLES.includes(user.role)
  const isNoEmailUser = !user.email && isCustomerRole

  useEffect(() => {
    if (open && user.customerCompanyId) {
      fetch(`/api/admin/companies/${user.customerCompanyId}/users`)
        .then((r) => r.json())
        .then((data) =>
          setCompanyUsers(
            (data.users ?? []).filter(
              (u: CompanyUser) => u.email && u.id !== user.id
            )
          )
        )
        .catch(() => setCompanyUsers([]))
    }
  }, [open, user.customerCompanyId, user.id])

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!formData.displayName) {
        toast({
          title: 'Validation Error',
          description: 'Display name is required',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          jobRole: formData.jobRole || null,
          lineManagerId: isNoEmailUser ? formData.lineManagerId || null : null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update user')
      }

      toast({ title: 'Success', description: 'User details updated.' })
      onUserUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating user:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update user details',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View and edit user information.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='displayName'>Display Name</Label>
              <Input
                id='displayName'
                value={formData.displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange('displayName', e.target.value)
                }
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='jobRole'>Job Role</Label>
              <Input
                id='jobRole'
                value={formData.jobRole}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange('jobRole', e.target.value)
                }
                placeholder='e.g. Site Manager'
                disabled={isLoading}
              />
            </div>

            {isNoEmailUser && (
              <div className='grid gap-2'>
                <Label htmlFor='lineManager'>Line Manager</Label>
                <Select
                  value={formData.lineManagerId}
                  onValueChange={(value) =>
                    handleChange('lineManagerId', value)
                  }
                  disabled={isLoading || companyUsers.length === 0}
                >
                  <SelectTrigger id='lineManager'>
                    <SelectValue placeholder='Select line manager...' />
                  </SelectTrigger>
                  <SelectContent>
                    {companyUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  Notifications and reminders are sent to their line manager.
                </p>
              </div>
            )}

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label className='text-muted-foreground'>Email</Label>
                <p className='text-sm mt-1'>
                  {user.email ?? (
                    <span className='text-muted-foreground italic'>
                      No email — kiosk sign-off
                    </span>
                  )}
                </p>
              </div>

              <div>
                <Label className='text-muted-foreground'>Role</Label>
                <p className='text-sm mt-1'>{user.role}</p>
              </div>
            </div>

            <div>
              <Label className='text-muted-foreground'>Created</Label>
              <p className='text-sm mt-1'>{formatDate(user.createdDateTime)}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
