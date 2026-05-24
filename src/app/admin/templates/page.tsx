// src/app/admin/templates/page.tsx
'use client'

import { BookOpen, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CreateTemplateDialog } from '@/components/admin/create-template-dialog'
import { EditTemplateDialog } from '@/components/admin/edit-template-dialog'
import { ViewTemplateDialog } from '@/components/admin/view-template-dialog'
import { Badge } from '@/components/ui/badge'
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
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormField } from '@/types/form-schema'

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
  questions: ComprehensionQuestion[] | null
  blobPath: string | null
  version: number
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

  async function handlePublishNewVersion(id: string, title: string) {
    if (
      !confirm(
        `Publish a new version of "${title}"?\n\nThis will create fresh assignment cycles for all currently assigned companies. Old completions remain as historical records.`
      )
    )
      return

    try {
      const response = await fetch(
        `/api/admin/templates/${id}/publish-version`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to publish new version')
      }

      const data = await response.json()
      toast({
        title: 'New version published',
        description: `"${title}" is now v${data.newVersion}. ${data.assignmentsCreated} new assignment${data.assignmentsCreated === 1 ? '' : 's'} created.`
      })
      fetchTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to publish new version',
        variant: 'destructive'
      })
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
          <TableCell colSpan={3} className='h-24 text-center'>
            Loading templates...
          </TableCell>
        </TableRow>
      )
    }

    if (templates.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={3} className='h-24 text-center'>
            No templates yet. Create your first document template.
          </TableCell>
        </TableRow>
      )
    }

    return templates.map((template) => (
      <TableRow key={template.id}>
        <TableCell className='font-medium'>
          <div className='flex items-center gap-2'>
            {template.title}
            {template.version > 1 && (
              <Badge variant='secondary' className='text-xs'>
                v{template.version}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {template.description ?? '—'}
        </TableCell>

        <TableCell>
          <div className='flex flex-col items-end gap-1 min-[520px]:flex-row min-[520px]:justify-end'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setViewingTemplate(template)}
            >
              <Eye className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setEditingTemplate(template)}
            >
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              title='Publish new version'
              onClick={() =>
                handlePublishNewVersion(template.id, template.title)
              }
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleDelete(template.id, template.title)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Document Templates</h1>
        <div className='flex items-center gap-2'>
          <Button variant='outline' asChild>
            <a href='/api/admin/manual' download>
              <BookOpen className='mr-2 h-4 w-4' />
              User Guide
            </a>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            New Template
          </Button>
        </div>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>

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
