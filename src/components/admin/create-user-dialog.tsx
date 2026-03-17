// src/components/admin/create-user-dialog.tsx
'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

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

interface CreateUserDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onUserCreated: () => void
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onUserCreated
}: CreateUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'Customer', // Default to Customer role
    accountEnabled: true
  })

  // Handle form input changes
  function handleChange(field: string, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

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

  // Create the user
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Basic validation
      if (!formData.displayName || !formData.email || !formData.password) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      // Create user through API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email,
          password: formData.password,
          role: formData.role
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create user')
      }

      // Call success callback
      onUserCreated()

      // Reset form
      setFormData({
        displayName: '',
        email: '',
        password: '',
        role: 'Customer',
        accountEnabled: true
      })
    } catch (error) {
      console.error('Error creating user:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create user',
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
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the document portal.
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
                placeholder='John Doe'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange('email', e.target.value)
                }
                placeholder='john.doe@example.com'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <div className='flex justify-between items-center'>
                <Label htmlFor='password'>Password</Label>
                <Button
                  type='button'
                  variant='link'
                  size='sm'
                  className='h-auto px-0 text-xs'
                  onClick={() =>
                    handleChange('password', generateRandomPassword())
                  }
                  disabled={isLoading}
                >
                  Generate
                </Button>
              </div>
              <Input
                id='password'
                type='password'
                value={formData.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange('password', e.target.value)
                }
                placeholder='••••••••'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='role'>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: string) => handleChange('role', value)}
                disabled={isLoading}
              >
                <SelectTrigger id='role'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Administrator'>Administrator</SelectItem>
                  <SelectItem value='Employee'>Employee</SelectItem>
                  <SelectItem value='Customer'>Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
