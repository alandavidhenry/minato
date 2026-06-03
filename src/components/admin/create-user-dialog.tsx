// src/components/admin/create-user-dialog.tsx
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
import { PasswordInput } from '@/components/ui/password-input'
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

interface CompanyUser {
  id: string
  displayName: string
  email: string | null
}

interface CreateUserDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onUserCreated: () => void
}

const CUSTOMER_ROLES = ['Customer Admin', 'Customer User']

export function CreateUserDialog({
  open,
  onOpenChange,
  onUserCreated
}: CreateUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'Customer User',
    jobRole: '',
    customerCompanyId: '',
    lineManagerId: ''
  })

  useEffect(() => {
    if (open) {
      fetch('/api/admin/companies')
        .then((r) => r.json())
        .then((data) => setCompanies(data.companies ?? []))
        .catch(() => setCompanies([]))
    }
  }, [open])

  useEffect(() => {
    if (formData.customerCompanyId) {
      fetch(`/api/admin/companies/${formData.customerCompanyId}/users`)
        .then((r) => r.json())
        .then((data) =>
          setCompanyUsers(
            (data.users ?? []).filter((u: CompanyUser) => u.email)
          )
        )
        .catch(() => setCompanyUsers([]))
    } else {
      setCompanyUsers([])
    }
  }, [formData.customerCompanyId])

  const isCustomerRole = CUSTOMER_ROLES.includes(formData.role)
  const hasEmail = formData.email.trim().length > 0
  const isNoEmailWorker = isCustomerRole && !hasEmail

  function handleChange(field: string, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'role' &&
        !CUSTOMER_ROLES.includes(value as string) && {
          customerCompanyId: '',
          lineManagerId: ''
        }),
      // Clear line manager when email is added
      ...(field === 'email' && value && { lineManagerId: '' })
    }))
  }

  function generateRandomPassword() {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    password += chars.charAt(Math.floor(Math.random() * 26))
    password += chars.charAt(Math.floor(Math.random() * 26) + 26)
    password += chars.charAt(Math.floor(Math.random() * 10) + 52)
    password += chars.charAt(Math.floor(Math.random() * 10) + 62)
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('')
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

      if (isCustomerRole && !formData.customerCompanyId) {
        toast({
          title: 'Validation Error',
          description: 'Please select a company for customer users',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      if (hasEmail && !formData.password) {
        toast({
          title: 'Validation Error',
          description: 'Password is required when an email address is provided',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      if (isNoEmailWorker && !formData.lineManagerId) {
        toast({
          title: 'Validation Error',
          description:
            'No-email workers must have a line manager assigned for notification routing',
          variant: 'destructive'
        })
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email || undefined,
          password: formData.password || undefined,
          role: formData.role,
          jobRole: isCustomerRole ? formData.jobRole || undefined : undefined,
          customerCompanyId: isCustomerRole
            ? formData.customerCompanyId
            : undefined,
          lineManagerId: isNoEmailWorker ? formData.lineManagerId : undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create user')
      }

      onUserCreated()
      setFormData({
        displayName: '',
        email: '',
        password: '',
        role: 'Customer User',
        jobRole: '',
        customerCompanyId: '',
        lineManagerId: ''
      })
    } catch (error) {
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
              Add a new user to the Minato platform.
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
              <Label htmlFor='email'>
                Email{' '}
                {isCustomerRole && (
                  <span className='text-muted-foreground font-normal'>
                    (optional — leave blank for no-email workers)
                  </span>
                )}
              </Label>
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

            {hasEmail && (
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
                <PasswordInput
                  id='password'
                  value={formData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('password', e.target.value)
                  }
                  placeholder='••••••••'
                  disabled={isLoading}
                />
              </div>
            )}

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
                <Label htmlFor='jobRole'>Job Role (optional)</Label>
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
            )}

            {isCustomerRole && (
              <div className='grid gap-2'>
                <Label htmlFor='company'>Company</Label>
                <Select
                  value={formData.customerCompanyId}
                  onValueChange={(value: string) =>
                    handleChange('customerCompanyId', value)
                  }
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

            {isNoEmailWorker && (
              <div className='grid gap-2'>
                <Label htmlFor='lineManager'>Line Manager</Label>
                <Select
                  value={formData.lineManagerId}
                  onValueChange={(value: string) =>
                    handleChange('lineManagerId', value)
                  }
                  disabled={isLoading || companyUsers.length === 0}
                >
                  <SelectTrigger id='lineManager'>
                    <SelectValue
                      placeholder={
                        companyUsers.length === 0
                          ? 'Select a company first'
                          : 'Select line manager...'
                      }
                    />
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
                  Notifications and reminders for this worker will be sent to
                  their line manager.
                </p>
              </div>
            )}
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
