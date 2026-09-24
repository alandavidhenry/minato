'use client'

import { Pencil, Plus, Send, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CreateTemplateDialog } from '@/components/admin/create-template-dialog'
import { EditTemplateDialog } from '@/components/admin/edit-template-dialog'
import { AssignCompanyTemplateDialog } from '@/components/customer/assign-company-template-dialog'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type {
  DocumentTemplateSourceType,
  DocumentTemplateUploadMode
} from '@/types/document-template'
import type { FormField } from '@/types/form-schema'

import type { ColumnDef } from '@tanstack/react-table'

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
  questions: ComprehensionQuestion[] | null
  blobPath: string | null
  version: number
  createdAt: string
  category: string
  sourceType: DocumentTemplateSourceType
  uploadMode: DocumentTemplateUploadMode | null
  sourceDocFileName: string | null
}

const API_BASE = '/api/customer/admin/templates'

export default function CompanyTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [assignedTemplateIds, setAssignedTemplateIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [assigningTemplate, setAssigningTemplate] = useState<Template | null>(
    null
  )

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [templatesRes, assignmentsRes] = await Promise.all([
        fetch(API_BASE),
        fetch('/api/customer/admin/assignments')
      ])
      if (!templatesRes.ok) throw new Error('Failed to fetch templates')
      if (!assignmentsRes.ok) throw new Error('Failed to fetch assignments')
      const [templatesData, assignmentsData] = await Promise.all([
        templatesRes.json(),
        assignmentsRes.json()
      ])
      setTemplates(templatesData.templates)
      setAssignedTemplateIds(
        assignmentsData.assignments.map(
          (a: { templateId: string }) => a.templateId
        )
      )
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
      const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast({ title: 'Success', description: `"${title}" deleted.` })
      fetchData()
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
    fetchData()
    setShowCreateDialog(false)
    toast({ title: 'Success', description: 'Template created successfully.' })
  }

  function handleTemplateSaved() {
    fetchData()
    setEditingTemplate(null)
    toast({ title: 'Success', description: 'Template saved.' })
  }

  function handleAssigned() {
    fetchData()
    setAssigningTemplate(null)
    toast({ title: 'Assigned', description: 'Template assigned successfully.' })
  }

  const columns: ColumnDef<typeof dataTableFeatures, Template>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const template = row.original
        return (
          <div className='flex items-center gap-2 font-medium'>
            {template.title}
            {template.sourceType === 'upload' && (
              <Badge variant='outline' className='text-xs'>
                Uploaded
              </Badge>
            )}
            {template.version > 1 && (
              <Badge variant='secondary' className='text-xs'>
                v{template.version}
              </Badge>
            )}
            {assignedTemplateIds.includes(template.id) && (
              <Badge variant='outline' className='text-xs'>
                Assigned
              </Badge>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.original.description ?? '—'}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => {
        const template = row.original
        const isAssigned = assignedTemplateIds.includes(template.id)
        return (
          <div className='flex flex-col items-end gap-1 min-[520px]:flex-row min-[520px]:justify-end'>
            <Button
              variant='ghost'
              size='sm'
              title={isAssigned ? 'Already assigned' : 'Assign to employees'}
              disabled={isAssigned}
              onClick={() => setAssigningTemplate(template)}
            >
              <Send className='h-4 w-4' />
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
              onClick={() => handleDelete(template.id, template.title)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        )
      }
    }
  ]

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Company Templates'
        description='Create and assign forms specific to your company — visible only to your employees.'
        actions={
          <>
            <Button variant='outline' asChild>
              <Link href='/customer/admin/completions'>
                <Users className='mr-2 h-4 w-4' />
                Team Compliance
              </Link>
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className='mr-2 h-4 w-4' />
              New Template
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        emptyTitle='No company templates yet'
        emptyDescription='Create your first internal form.'
      />

      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTemplateCreated={handleTemplateCreated}
        apiBasePath={API_BASE}
      />

      <EditTemplateDialog
        open={editingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null)
        }}
        template={editingTemplate}
        onTemplateSaved={handleTemplateSaved}
        apiBasePath={API_BASE}
      />

      <AssignCompanyTemplateDialog
        open={assigningTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setAssigningTemplate(null)
        }}
        template={assigningTemplate}
        onAssigned={handleAssigned}
      />
    </div>
  )
}
