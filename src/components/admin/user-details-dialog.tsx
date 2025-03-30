'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface User {
  id: string
  displayName: string
  mail: string
  userPrincipalName: string
  accountEnabled: boolean
  appRoleAssignments?: any[]
  createdDateTime?: string
  jobTitle?: string
  department?: string
}

interface UserDetailsDialogProps {
  readonly user: User
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onUserUpdated: () => void
}

export function UserDetailsDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated
}: UserDetailsDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    displayName: user.displayName,
    jobTitle: user.jobTitle ?? '',
    department: user.department ?? ''
  })

  // Handle form input changes
  function handleChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  // Update user details
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Basic validation
      if (!formData.displayName) {
        toast({
          title: 'Validation Error',
          description: 'Display name is required',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      // Update user through API
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: formData.displayName,
          jobTitle: formData.jobTitle,
          department: formData.department
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update user')
      }

      toast({
        title: 'Success',
        description: 'User details updated successfully'
      })

      // Call success callback
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

  // Format date
  function formatDate(dateString?: string): string {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
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
            {/* Editable fields */}
            <div className='grid gap-2'>
              <Label htmlFor='displayName'>Display Name</Label>
              <Input
                id='displayName'
                value={formData.displayName}
                onChange={(e: any) =>
                  handleChange('displayName', e.target.value)
                }
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='jobTitle'>Job Title</Label>
              <Input
                id='jobTitle'
                value={formData.jobTitle}
                onChange={(e: any) => handleChange('jobTitle', e.target.value)}
                placeholder='Not specified'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='department'>Department</Label>
              <Input
                id='department'
                value={formData.department}
                onChange={(e: any) =>
                  handleChange('department', e.target.value)
                }
                placeholder='Not specified'
                disabled={isLoading}
              />
            </div>

            {/* Read-only fields */}
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label className='text-muted-foreground'>Email</Label>
                <p className='text-sm mt-1'>
                  {user.mail || user.userPrincipalName}
                </p>
              </div>

              <div>
                <Label className='text-muted-foreground'>Status</Label>
                <p className='text-sm mt-1'>
                  {user.accountEnabled ? 'Active' : 'Disabled'}
                </p>
              </div>
            </div>

            <div>
              <Label className='text-muted-foreground'>
                User Principal Name
              </Label>
              <p className='text-sm mt-1'>{user.userPrincipalName}</p>
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
