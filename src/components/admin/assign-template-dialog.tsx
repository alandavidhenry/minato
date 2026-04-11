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
  description: string | null
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
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTemplates()
      setSelectedTemplateId('')
    }
  }, [open])

  async function fetchTemplates() {
    setIsFetching(true)
    try {
      const res = await fetch('/api/admin/templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data.templates)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load templates.',
        variant: 'destructive'
      })
    } finally {
      setIsFetching(false)
    }
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
        body: JSON.stringify({ templateId: selectedTemplateId })
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
            <div className='grid gap-2'>
              <Label htmlFor='template'>Template</Label>
              {isFetching ? (
                <p className='text-sm text-muted-foreground'>
                  Loading templates...
                </p>
              ) : availableTemplates.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  All templates are already assigned to this company.
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
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type='submit'
              disabled={
                isLoading || isFetching || availableTemplates.length === 0
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
