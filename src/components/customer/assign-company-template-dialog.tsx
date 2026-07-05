'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface CompanyUser {
  id: string
  jobRole: string | null
}

interface Template {
  id: string
  title: string
}

interface AssignCompanyTemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly template: Template | null
  readonly onAssigned: () => void
}

export function AssignCompanyTemplateDialog({
  open,
  onOpenChange,
  template,
  onAssigned
}: AssignCompanyTemplateDialogProps) {
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [dueDate, setDueDate] = useState('')
  const [selectedJobRoles, setSelectedJobRoles] = useState<string[]>([])
  const [autoEnroll, setAutoEnroll] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (open) {
      fetchUsers()
      setDueDate('')
      setSelectedJobRoles([])
      setAutoEnroll(false)
    }
    // fetchUsers is stable (declared in component body, no deps); open is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function fetchUsers() {
    setIsFetching(true)
    try {
      const res = await fetch('/api/customer/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setCompanyUsers(data.users)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load employees.',
        variant: 'destructive'
      })
    } finally {
      setIsFetching(false)
    }
  }

  function toggleJobRole(role: string) {
    setSelectedJobRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/customer/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          dueDate: dueDate || undefined,
          targetJobRoles:
            selectedJobRoles.length > 0 ? selectedJobRoles : undefined,
          autoEnroll
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign template')
      }

      onAssigned()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to assign template',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const companyJobRoles = Array.from(
    new Set(
      companyUsers
        .map((u) => u.jobRole)
        .filter((role): role is string => Boolean(role))
    )
  ).sort()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign &quot;{template?.title}&quot;</DialogTitle>
            <DialogDescription>
              Assign this template to your employees.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {isFetching ? (
              <p className='text-sm text-muted-foreground'>Loading...</p>
            ) : (
              <>
                <div className='grid gap-2'>
                  <Label htmlFor='company-due-date'>Due date (optional)</Label>
                  <Input
                    id='company-due-date'
                    type='date'
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='company-target-job-roles'>
                    Restrict to job roles (optional)
                  </Label>
                  {companyJobRoles.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No job roles set on your employees yet.
                    </p>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id='company-target-job-roles'
                          type='button'
                          variant='outline'
                          className='justify-start font-normal'
                          disabled={isLoading}
                        >
                          {selectedJobRoles.length === 0
                            ? 'All job roles'
                            : `${selectedJobRoles.length} job role${selectedJobRoles.length > 1 ? 's' : ''} selected`}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className='max-h-72 overflow-y-auto'>
                        {companyJobRoles.map((role) => (
                          <DropdownMenuCheckboxItem
                            key={role}
                            checked={selectedJobRoles.includes(role)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={() => toggleJobRole(role)}
                          >
                            {role}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Leave none selected to show to all employees.
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='company-auto-enroll'
                    checked={autoEnroll}
                    onCheckedChange={(checked) =>
                      setAutoEnroll(checked === true)
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor='company-auto-enroll' className='font-normal'>
                    Auto-enroll matching employees
                  </Label>
                </div>
                <p className='-mt-2 text-xs text-muted-foreground'>
                  Automatically creates an individual assignment record for
                  every current and future employee whose job role matches,
                  giving each an explicit enrolment date.
                </p>
              </>
            )}
          </div>

          {!isFetching && (
            <DialogFooter>
              <Button type='submit' disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Assigning...
                  </>
                ) : (
                  'Assign Template'
                )}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
