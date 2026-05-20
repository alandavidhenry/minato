// src/app/admin/companies/[id]/page.tsx
'use client'

import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AssignTemplateDialog } from '@/components/admin/assign-template-dialog'
import { AssignToUserDialog } from '@/components/admin/assign-to-user-dialog'
import { EditCompanyDialog } from '@/components/admin/edit-company-dialog'
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

interface Company {
  id: string
  name: string
  createdAt: string
}

interface Assignment {
  id: string
  templateId: string
  userId: string | null
  dueDate: string | null
  createdAt: string
  template: {
    id: string
    title: string
    description: string | null
    blobPath: string | null
  }
}

interface CompanyUser {
  id: string
  displayName: string
  email: string
  role: string
}

interface UserWithAssignments {
  user: CompanyUser
  assignments: Assignment[]
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [userAssignments, setUserAssignments] = useState<UserWithAssignments[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAssignToUserDialog, setShowAssignToUserDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [companyRes, assignmentsRes, userAssignmentsRes] =
        await Promise.all([
          fetch(`/api/admin/companies/${id}`),
          fetch(`/api/admin/companies/${id}/assignments`),
          fetch(`/api/admin/companies/${id}/user-assignments`)
        ])

      if (!companyRes.ok) throw new Error('Company not found')
      if (!assignmentsRes.ok) throw new Error('Failed to load assignments')
      if (!userAssignmentsRes.ok)
        throw new Error('Failed to load user assignments')

      const [companyData, assignmentsData, userAssignmentsData] =
        await Promise.all([
          companyRes.json(),
          assignmentsRes.json(),
          userAssignmentsRes.json()
        ])

      setCompany(companyData.company)
      setAssignments(assignmentsData.assignments)
      setUserAssignments(userAssignmentsData.userAssignments)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load company details.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  async function handleRemoveUserAssignment(
    assignmentId: string,
    templateTitle: string,
    userName: string
  ) {
    if (
      !confirm(
        `Remove "${templateTitle}" from ${userName}? This cannot be undone.`
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

      toast({
        title: 'Removed',
        description: `"${templateTitle}" removed from ${userName}.`
      })
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

  const usersWithIndividualAssignments = userAssignments.filter(
    (ua) => ua.assignments.length > 0
  )

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
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setShowEditDialog(true)}
        >
          <Pencil className='h-4 w-4' />
        </Button>
      </div>

      {/* Company-wide assignments */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-xl font-semibold'>Company-wide Templates</h2>
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
                <TableHead>Due date</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='h-24 text-center'>
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
                      {a.dueDate
                        ? new Date(a.dueDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
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

      {/* Individual user assignments */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-xl font-semibold'>Individual User Templates</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              Templates assigned to specific users only, in addition to
              company-wide templates.
            </p>
          </div>
          <Button
            onClick={() => setShowAssignToUserDialog(true)}
            size='sm'
            variant='outline'
          >
            <Plus className='mr-2 h-4 w-4' />
            Assign to User
          </Button>
        </div>

        {usersWithIndividualAssignments.length === 0 ? (
          <div className='rounded-md border'>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className='h-24 text-center text-muted-foreground'>
                    No individual assignments yet. Use &quot;Assign to
                    User&quot; to give specific users extra templates.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className='space-y-4'>
            {usersWithIndividualAssignments.map(({ user, assignments: ua }) => (
              <div key={user.id} className='rounded-md border'>
                <div className='flex items-center gap-2 px-4 py-2 border-b bg-muted/40'>
                  <span className='font-medium text-sm'>
                    {user.displayName}
                  </span>
                  <Badge variant='secondary' className='text-xs'>
                    {user.role}
                  </Badge>
                  <span className='text-xs text-muted-foreground'>
                    {user.email}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Has File</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ua.map((a) => (
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
                          {a.dueDate
                            ? new Date(a.dueDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {new Date(a.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              handleRemoveUserAssignment(
                                a.id,
                                a.template.title,
                                user.displayName
                              )
                            }
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </div>

      <AssignTemplateDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        companyId={id}
        onAssigned={handleAssigned}
        assignedTemplateIds={assignments.map((a) => a.templateId)}
      />

      <AssignToUserDialog
        open={showAssignToUserDialog}
        onOpenChange={setShowAssignToUserDialog}
        companyId={id}
        onAssigned={handleAssigned}
      />

      <EditCompanyDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        company={company}
        onCompanySaved={() => {
          fetchData()
          setShowEditDialog(false)
          toast({
            title: 'Success',
            description: 'Company updated successfully.'
          })
        }}
      />
    </div>
  )
}
