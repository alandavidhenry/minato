// src/app/admin/templates/page.tsx
'use client'

import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CreateTemplateDialog } from '@/components/admin/create-template-dialog'
import { EditTemplateDialog } from '@/components/admin/edit-template-dialog'
import { ViewTemplateDialog } from '@/components/admin/view-template-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import type { FormField } from '@/types/form-schema'

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
  blobPath: string | null
  createdAt: string
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      setTemplates(data.templates)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load templates.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return

    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast({ title: 'Success', description: `"${title}" deleted.` })
      fetchTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive'
      })
    }
  }

  function handleTemplateCreated() {
    fetchTemplates()
    setShowCreateDialog(false)
    toast({ title: 'Success', description: 'Template created successfully.' })
  }

  function handleTemplateSaved() {
    fetchTemplates()
    setEditingTemplate(null)
    toast({ title: 'Success', description: 'Template saved.' })
  }

  function renderRows() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={4} className='h-24 text-center'>
            Loading templates...
          </TableCell>
        </TableRow>
      )
    }

    if (templates.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className='h-24 text-center'>
            No templates yet. Create your first document template.
          </TableCell>
        </TableRow>
      )
    }

    return templates.map((template) => (
      <TableRow key={template.id}>
        <TableCell className='font-medium'>{template.title}</TableCell>
        <TableCell className='text-muted-foreground'>
          {template.description ?? '—'}
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {template.formSchema && template.formSchema.length > 0
            ? `${template.formSchema.length} field${template.formSchema.length === 1 ? '' : 's'}`
            : '—'}
        </TableCell>
        <TableCell className='text-right'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setViewingTemplate(template)}
            className='mr-1'
          >
            <Eye className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setEditingTemplate(template)}
            className='mr-1'
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handleDelete(template.id, template.title)}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Document Templates</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          New Template
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Form Fields</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>

      <ViewTemplateDialog
        open={viewingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setViewingTemplate(null)
        }}
        template={viewingTemplate}
      />

      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTemplateCreated={handleTemplateCreated}
      />

      <EditTemplateDialog
        open={editingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null)
        }}
        template={editingTemplate}
        onTemplateSaved={handleTemplateSaved}
      />
    </div>
  )
}
