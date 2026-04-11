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
import { toast } from '@/components/ui/use-toast'

interface CreateTemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onTemplateCreated: () => void
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onTemplateCreated
}: CreateTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '' })

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template title is required',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      onTemplateCreated()
      setFormData({ title: '', description: '' })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create template',
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
            <DialogTitle>Create Document Template</DialogTitle>
            <DialogDescription>
              Add a reusable H&amp;S document template to the library.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder='Farmyard Safety Checklist'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>
                Description{' '}
                <span className='text-muted-foreground'>(optional)</span>
              </Label>
              <Input
                id='description'
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder='Brief description of the document'
                disabled={isLoading}
              />
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
                'Create Template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
