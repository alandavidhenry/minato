'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

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

interface Template {
  id: string
  title: string
}

interface CompanyUser {
  id: string
  displayName: string
  email: string
}

interface AssignToUserDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly companyId: string
  readonly onAssigned: () => void
}

export function AssignToUserDialog({
  open,
  onOpenChange,
  companyId,
  onAssigned
}: AssignToUserDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (open) {
      fetchData()
      setSelectedTemplateId('')
      setSelectedUserId('')
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
      setUsers(usersData.users)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedTemplateId || !selectedUserId) {
      toast({
        title: 'Validation Error',
        description: 'Please select both a user and a template.',
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
          userId: selectedUserId
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

  const noUsers = !isFetching && users.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign Template to User</DialogTitle>
            <DialogDescription>
              Assign a template to a specific user in this company. They will
              see it in addition to any company-wide assignments.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            {isFetching ? (
              <p className='text-sm text-muted-foreground'>Loading...</p>
            ) : noUsers ? (
              <p className='text-sm text-muted-foreground'>
                No users in this company yet.
              </p>
            ) : (
              <>
                <div className='grid gap-2'>
                  <Label htmlFor='user'>User</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={isLoading}
                  >
                    <SelectTrigger id='user'>
                      <SelectValue placeholder='Select a user' />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='template'>Template</Label>
                  {templates.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No templates available.
                    </p>
                  ) : (
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      disabled={isLoading}
                    >
                      <SelectTrigger id='template'>
                        <SelectValue placeholder='Select a template' />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type='submit'
              disabled={
                isLoading || isFetching || noUsers || templates.length === 0
              }
            >
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
        </form>
      </DialogContent>
    </Dialog>
  )
}
