// src/app/admin/companies/[id]/page.tsx
'use client'

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AssignTemplateDialog } from '@/components/admin/assign-template-dialog'
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

interface Company {
  id: string
  name: string
  createdAt: string
}

interface Assignment {
  id: string
  templateId: string
  createdAt: string
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
  }
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAssignDialog, setShowAssignDialog] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [companyRes, assignmentsRes] = await Promise.all([
        fetch(`/api/admin/companies/${id}`),
        fetch(`/api/admin/companies/${id}/assignments`)
      ])

      if (!companyRes.ok) throw new Error('Company not found')
      if (!assignmentsRes.ok) throw new Error('Failed to load assignments')

      const [companyData, assignmentsData] = await Promise.all([
        companyRes.json(),
        assignmentsRes.json()
      ])

      setCompany(companyData.company)
      setAssignments(assignmentsData.assignments)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load company details.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRemove(assignmentId: string, templateTitle: string) {
    if (
      !confirm(
        `Remove "${templateTitle}" from this company? This cannot be undone.`
      )
    )
      return

    try {
      const res = await fetch(
        `/api/admin/companies/${id}/assignments/${assignmentId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove assignment')
      }

      toast({ title: 'Removed', description: `"${templateTitle}" unassigned.` })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to remove assignment',
        variant: 'destructive'
      })
    }
  }

  function handleAssigned() {
    fetchData()
    toast({ title: 'Assigned', description: 'Template assigned successfully.' })
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>Loading...</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className='space-y-4'>
        <Link
          href='/admin/companies'
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to Companies
        </Link>
        <p className='text-muted-foreground'>Company not found.</p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Link
          href='/admin/companies'
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Back
        </Link>
        <h1 className='text-3xl font-bold'>{company.name}</h1>
      </div>

      <div>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-semibold'>Assigned Templates</h2>
          <Button onClick={() => setShowAssignDialog(true)} size='sm'>
            <Plus className='mr-2 h-4 w-4' />
            Assign Template
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Has File</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-24 text-center'>
                    No templates assigned yet. Click &quot;Assign Template&quot;
                    to get started.
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className='font-medium'>
                      {a.template.title}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {a.template.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      {a.template.blobPath ? (
                        <span className='text-green-600 text-sm'>Yes</span>
                      ) : (
                        <span className='text-muted-foreground text-sm'>
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {new Date(a.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleRemove(a.id, a.template.title)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AssignTemplateDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        companyId={id}
        onAssigned={handleAssigned}
        assignedTemplateIds={assignments.map((a) => a.templateId)}
      />
    </div>
  )
}
