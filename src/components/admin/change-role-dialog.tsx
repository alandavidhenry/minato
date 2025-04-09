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

interface ChangeRoleDialogProps {
  readonly userId: string
  readonly userName: string
  readonly currentRole: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onRoleChanged: () => void
}

export function ChangeRoleDialog({
  userId,
  userName,
  currentRole,
  open,
  onOpenChange,
  onRoleChanged
}: ChangeRoleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState(currentRole)

  // Reset selected role when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRole(currentRole)
    }
  }, [open, currentRole])

  // Handle role change
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // No change, just close the dialog
    if (selectedRole === currentRole) {
      onOpenChange(false)
      return
    }

    setIsLoading(true)

    try {
      // Update the user's role
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to assign role')
      }

      toast({
        title: 'Success',
        description: `User role changed to ${selectedRole}`
      })

      // Call success callback
      onRoleChanged()
      onOpenChange(false)
    } catch (error) {
      console.error('Error changing role:', error)
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
                onValueChange={setSelectedRole}
                disabled={isLoading}
              >
                <SelectTrigger id='newRole'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Administrator'>Administrator</SelectItem>
                  <SelectItem value='Employee'>Employee</SelectItem>
                  <SelectItem value='Customer'>Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === 'Administrator' && (
              <div className='rounded-md bg-amber-50 p-3'>
                <p className='text-sm text-amber-800'>
                  Warning: Administrators have full access to manage users and
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
            <Button
              type='submit'
              disabled={isLoading || selectedRole === currentRole}
            >
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
