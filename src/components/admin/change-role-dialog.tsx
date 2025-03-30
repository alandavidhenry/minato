'use client'

import { Loader2, UserCog } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ChangeRoleDialogProps {
  readonly userId: string
  readonly userName: string
  readonly currentRole: string
  readonly userAppRoleAssignments: any[]
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onRoleChanged: () => void
}

export function ChangeRoleDialog({
  userId,
  userName,
  currentRole,
  userAppRoleAssignments,
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
      // If the user already has a role, we need to remove it first
      if (currentRole !== 'Guest' && userAppRoleAssignments.length > 0) {
        // Find the current role assignment
        const roleAssignment = userAppRoleAssignments.find((role) => {
          if (currentRole === 'Administrator') {
            return (
              role.appRoleId === process.env.NEXT_PUBLIC_AZURE_AD_ADMIN_ROLE_ID
            )
          } else if (currentRole === 'User') {
            return (
              role.appRoleId === process.env.NEXT_PUBLIC_AZURE_AD_USER_ROLE_ID
            )
          }
          return false
        })

        if (roleAssignment) {
          // Remove the current role
          await fetch(`/api/admin/users/${userId}/role`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              appRoleAssignmentId: roleAssignment.id
            })
          })
        }
      }

      // If selecting a new role (not Guest), assign it
      if (selectedRole !== 'Guest') {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: selectedRole
          })
        })

        if (!response.ok) {
          throw new Error('Failed to assign role')
        }
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
                  <SelectItem value='User'>User</SelectItem>
                  <SelectItem value='Guest'>Guest</SelectItem>
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
