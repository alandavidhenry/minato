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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

interface Template {
  id: string
  title: string
  description: string | null
}

interface CompanyUser {
  id: string
  jobRole: string | null
}

interface AssignTemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly companyId: string
  readonly onAssigned: () => void
  readonly assignedTemplateIds: string[]
}

export function AssignTemplateDialog({
  open,
  onOpenChange,
  companyId,
  onAssigned,
  assignedTemplateIds
}: AssignTemplateDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedJobRoles, setSelectedJobRoles] = useState<string[]>([])
  const [autoEnroll, setAutoEnroll] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (open) {
      fetchData()
      setSelectedTemplateId('')
      setDueDate('')
      setSelectedJobRoles([])
      setAutoEnroll(false)
    }
    // fetchData is stable (declared in component body, no deps); open is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function fetchData() {
    setIsFetching(true)
    try {
      const [templatesRes, usersRes] = await Promise.all([
        fetch('/api/admin/templates'),
        fetch(`/api/admin/companies/${companyId}/users`)
      ])
      if (!templatesRes.ok) throw new Error('Failed to fetch templates')
      if (!usersRes.ok) throw new Error('Failed to fetch users')
      const [templatesData, usersData] = await Promise.all([
        templatesRes.json(),
        usersRes.json()
      ])
      setTemplates(templatesData.templates)
      setCompanyUsers(usersData.users)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load data.',
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

    if (!selectedTemplateId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a template.',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId,
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
      onOpenChange(false)
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

  const availableTemplates = templates.filter(
    (t) => !assignedTemplateIds.includes(t.id)
  )

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
            <DialogTitle>Assign Template</DialogTitle>
            <DialogDescription>
              Select a document template to assign to this company.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {isFetching ? (
              <p className='text-sm text-muted-foreground'>
                Loading templates...
              </p>
            ) : availableTemplates.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                All templates are already assigned to this company.
              </p>
            ) : (
              <>
                <div className='grid gap-2'>
                  <Label htmlFor='due-date'>Due date (optional)</Label>
                  <Input
                    id='due-date'
                    type='date'
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='target-job-roles'>
                    Restrict to job roles (optional)
                  </Label>
                  {companyJobRoles.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No job roles set on users in this company yet.
                    </p>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id='target-job-roles'
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
                    Leave none selected to show to all users.
                  </p>
                </div>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='auto-enroll'
                    checked={autoEnroll}
                    onCheckedChange={(checked) =>
                      setAutoEnroll(checked === true)
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor='auto-enroll' className='font-normal'>
                    Auto-enroll matching users
                  </Label>
                </div>
                <p className='-mt-2 text-xs text-muted-foreground'>
                  Automatically creates an individual assignment record for
                  every current and future user whose job role matches, giving
                  each an explicit enrolment date.
                </p>
                <div className='grid gap-2'>
                  <Label htmlFor='template'>Template</Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                    disabled={isLoading}
                  >
                    <SelectTrigger id='template'>
                      <SelectValue placeholder='Select a template' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {!isFetching && availableTemplates.length > 0 && (
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
