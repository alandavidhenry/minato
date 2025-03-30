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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface ResetPasswordDialogProps {
  readonly userId: string
  readonly userName: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onPasswordReset: () => void
}

export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
  onPasswordReset
}: ResetPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [forceChange, setForceChange] = useState(true)

  // Helper to generate a random password
  function generateRandomPassword() {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''

    // Ensure at least one uppercase, one lowercase, one number and one special character
    password += chars.charAt(Math.floor(Math.random() * 26))
    password += chars.charAt(Math.floor(Math.random() * 26) + 26)
    password += chars.charAt(Math.floor(Math.random() * 10) + 52)
    password += chars.charAt(Math.floor(Math.random() * 10) + 62)

    // Add random chars to reach minimum length of 8
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('')
  }

  // Reset user password
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Basic validation
      if (!password) {
        toast({
          title: 'Validation Error',
          description: 'Password is required',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      // Password complexity check
      if (password.length < 8) {
        toast({
          title: 'Validation Error',
          description: 'Password must be at least 8 characters long',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      // Reset password through API
      const response = await fetch(
        `/api/admin/users/${userId}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password,
            forceChange
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to reset password')
      }

      toast({
        title: 'Success',
        description: 'Password reset successfully'
      })

      // Call success callback
      onPasswordReset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error resetting password:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to reset password',
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
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for user: {userName}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <div className='flex justify-between items-center'>
                <Label htmlFor='password'>New Password</Label>
                <Button
                  type='button'
                  variant='link'
                  size='sm'
                  className='h-auto px-0 text-xs'
                  onClick={() => setPassword(generateRandomPassword())}
                  disabled={isLoading}
                >
                  Generate Random
                </Button>
              </div>
              <Input
                id='password'
                type='text' // Using text to make it visible for admin
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                placeholder='New password'
                disabled={isLoading}
              />
            </div>

            <div className='flex items-center space-x-2'>
              <Checkbox
                id='forceChange'
                checked={forceChange}
                onCheckedChange={(checked) => setForceChange(checked === true)}
                disabled={isLoading}
              />
              <Label htmlFor='forceChange'>
                Force password change at next sign-in
              </Label>
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
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
