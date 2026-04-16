'use client'

import { Loader2, UserCog } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

interface Company {
  id: string
  name: string
}

interface ChangeRoleDialogProps {
  readonly userId: string
  readonly userName: string
  readonly currentRole: string
  readonly currentCustomerCompanyId: string | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onRoleChanged: () => void
}

const CUSTOMER_ROLES = ['Customer Admin', 'Customer User']

export function ChangeRoleDialog({
  userId,
  userName,
  currentRole,
  currentCustomerCompanyId,
  open,
  onOpenChange,
  onRoleChanged
}: ChangeRoleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState(currentRole)
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    currentCustomerCompanyId ?? ''
  )
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    if (open) {
      setSelectedRole(currentRole)
      setSelectedCompanyId(currentCustomerCompanyId ?? '')
      fetch('/api/admin/companies')
        .then((r) => r.json())
        .then((data) => setCompanies(data.companies ?? []))
        .catch(() => setCompanies([]))
    }
  }, [open, currentRole, currentCustomerCompanyId])

  const isCustomerRole = CUSTOMER_ROLES.includes(selectedRole)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const roleUnchanged = selectedRole === currentRole
    const companyUnchanged =
      selectedCompanyId === (currentCustomerCompanyId ?? '')

    if (roleUnchanged && companyUnchanged) {
      onOpenChange(false)
      return
    }

    if (isCustomerRole && !selectedCompanyId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a company for customer users',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          ...(isCustomerRole && { customerCompanyId: selectedCompanyId }),
          ...(!isCustomerRole && { customerCompanyId: null })
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign role')
      }

      toast({
        title: 'Success',
        description: `User role changed to ${selectedRole}`
      })

      onRoleChanged()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to change user role',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <UserCog className='h-5 w-5' />
              Change User Role
            </DialogTitle>
            <DialogDescription>
              Change the role for user: {userName}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='currentRole'>Current Role</Label>
              <div className='text-sm text-muted-foreground'>{currentRole}</div>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='newRole'>New Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => {
                  setSelectedRole(value)
                  if (!CUSTOMER_ROLES.includes(value)) setSelectedCompanyId('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger id='newRole'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Platform Admin'>Platform Admin</SelectItem>
                  <SelectItem value='Tenant Admin'>Tenant Admin</SelectItem>
                  <SelectItem value='Tenant Staff'>Tenant Staff</SelectItem>
                  <SelectItem value='Customer Admin'>Customer Admin</SelectItem>
                  <SelectItem value='Customer User'>Customer User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustomerRole && (
              <div className='grid gap-2'>
                <Label htmlFor='company'>Company</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                  disabled={isLoading}
                >
                  <SelectTrigger id='company'>
                    <SelectValue placeholder='Select a company' />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedRole === 'Platform Admin' ||
              selectedRole === 'Tenant Admin') && (
              <div className='rounded-md bg-amber-50 p-3'>
                <p className='text-sm text-amber-800'>
                  Warning: This role has full access to manage users and
                  settings.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
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
