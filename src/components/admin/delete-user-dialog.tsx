'use client'

import { Loader2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

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

import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'

interface DeleteUserDialogProps {
  readonly userId: string
  readonly userName: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onUserDeleted: () => void
}

export function DeleteUserDialog({
  userId,
  userName,
  open,
  onOpenChange,
  onUserDeleted
}: DeleteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  // Delete user
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validation
    if (confirmation !== userName) {
      toast({
        title: 'Validation Error',
        description: 'Please enter the correct user name to confirm deletion',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      // Delete user through API
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      toast({
        title: 'Success',
        description: 'User deleted successfully'
      })

      // Call success callback
      onUserDeleted()
      onOpenChange(false)
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete user',
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
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <p className='text-sm'>
              You are about to delete the user: <strong>{userName}</strong>
            </p>

            <div className='grid gap-2'>
              <Label htmlFor='confirmation'>
                Type the user name to confirm deletion:
              </Label>
              <Input
                id='confirmation'
                value={confirmation}
                onChange={(e: any) => setConfirmation(e.target.value)}
                placeholder={userName}
                disabled={isLoading}
              />
            </div>
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
              variant='destructive'
              disabled={isLoading || confirmation !== userName}
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
