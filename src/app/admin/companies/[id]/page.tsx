// src/app/admin/companies/[id]/page.tsx
'use client'

import { ArrowLeft, Copy, Pencil, Plus, QrCode, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { AssignTemplateDialog } from '@/components/admin/assign-template-dialog'
import { AssignToUserDialog } from '@/components/admin/assign-to-user-dialog'
import { EditCompanyDialog } from '@/components/admin/edit-company-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { QrCodeModal } from '@/components/qr-code-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import { nullableDateSortValue } from '@/components/ui/data-table/sort-utils'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

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
  targetJobRoles: string[] | null
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
  email: string | null
  role: string
}

interface UserWithAssignments {
  user: CompanyUser
  assignments: Assignment[]
}

interface CompanyTemplate {
  id: string
  title: string
  description: string | null
  version: number
  createdAt: string
}

function formatDueDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—'
}

function HasFileCell({ blobPath }: { readonly blobPath: string | null }) {
  return blobPath ? (
    <span className='text-sm text-success'>Yes</span>
  ) : (
    <span className='text-muted-foreground text-sm'>No</span>
  )
}

const companyTemplateColumns: ColumnDef<
  typeof dataTableFeatures,
  CompanyTemplate
>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => <span className='font-medium'>{row.original.title}</span>
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
    accessorKey: 'version',
    header: 'Version',
    cell: ({ row }) => (
      <Badge variant='secondary' className='text-xs'>
        v{row.original.version}
      </Badge>
    )
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className='text-muted-foreground'>
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    )
  }
]

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [userAssignments, setUserAssignments] = useState<UserWithAssignments[]>(
    []
  )
  const [companyTemplates, setCompanyTemplates] = useState<CompanyTemplate[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showAssignToUserDialog, setShowAssignToUserDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  useBreadcrumbLabel(`/admin/companies/${id}`, company?.name)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [companyRes, assignmentsRes, userAssignmentsRes, templatesRes] =
        await Promise.all([
          fetch(`/api/admin/companies/${id}`),
          fetch(`/api/admin/companies/${id}/assignments`),
          fetch(`/api/admin/companies/${id}/user-assignments`),
          fetch(`/api/admin/companies/${id}/templates`)
        ])

      if (!companyRes.ok) throw new Error('Company not found')
      if (!assignmentsRes.ok) throw new Error('Failed to load assignments')
      if (!userAssignmentsRes.ok)
        throw new Error('Failed to load user assignments')
      if (!templatesRes.ok) throw new Error('Failed to load company templates')

      const [companyData, assignmentsData, userAssignmentsData, templatesData] =
        await Promise.all([
          companyRes.json(),
          assignmentsRes.json(),
          userAssignmentsRes.json(),
          templatesRes.json()
        ])

      setCompany(companyData.company)
      setAssignments(assignmentsData.assignments)
      setUserAssignments(userAssignmentsData.userAssignments)
      setCompanyTemplates(templatesData.templates)
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

  const companyAssignmentColumns: ColumnDef<
    typeof dataTableFeatures,
    Assignment
  >[] = [
    {
      id: 'template',
      accessorFn: (row) => row.template.title,
      header: 'Template',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.template.title}</span>
      )
    },
    {
      id: 'description',
      accessorFn: (row) => row.template.description ?? '',
      header: 'Description',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.original.template.description ?? '—'}
        </span>
      )
    },
    {
      id: 'hasFile',
      header: 'Has File',
      enableSorting: false,
      cell: ({ row }) => (
        <HasFileCell blobPath={row.original.template.blobPath} />
      )
    },
    {
      id: 'jobRoles',
      header: 'Job Roles',
      enableSorting: false,
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {row.original.targetJobRoles && row.original.targetJobRoles.length > 0
            ? row.original.targetJobRoles.join(', ')
            : '—'}
        </span>
      )
    },
    {
      id: 'dueDate',
      accessorFn: (row) => nullableDateSortValue(row.dueDate),
      sortFn: 'basic',
      header: 'Due date',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {formatDueDate(row.original.dueDate)}
        </span>
      )
    },
    {
      id: 'createdAt',
      accessorFn: (row) => row.createdAt,
      header: 'Assigned',
      cell: ({ row }) => (
        <span className='text-muted-foreground'>
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          onClick={() =>
            handleRemove(row.original.id, row.original.template.title)
          }
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      )
    }
  ]

  function makeUserAssignmentColumns(
    userName: string
  ): ColumnDef<typeof dataTableFeatures, Assignment>[] {
    return [
      {
        id: 'template',
        accessorFn: (row) => row.template.title,
        header: 'Template',
        cell: ({ row }) => (
          <span className='font-medium'>{row.original.template.title}</span>
        )
      },
      {
        id: 'description',
        accessorFn: (row) => row.template.description ?? '',
        header: 'Description',
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {row.original.template.description ?? '—'}
          </span>
        )
      },
      {
        id: 'hasFile',
        header: 'Has File',
        enableSorting: false,
        cell: ({ row }) => (
          <HasFileCell blobPath={row.original.template.blobPath} />
        )
      },
      {
        id: 'dueDate',
        accessorFn: (row) => nullableDateSortValue(row.dueDate),
        sortFn: 'basic',
        header: 'Due date',
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {formatDueDate(row.original.dueDate)}
          </span>
        )
      },
      {
        id: 'createdAt',
        accessorFn: (row) => row.createdAt,
        header: 'Assigned',
        cell: ({ row }) => (
          <span className='text-muted-foreground'>
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        )
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              handleRemoveUserAssignment(
                row.original.id,
                row.original.template.title,
                userName
              )
            }
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        )
      }
    ]
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

  const kioskUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/signoff/${id}`
      : `/signoff/${id}`

  return (
    <div className='space-y-6'>
      <PageHeader
        title={company.name}
        backHref='/admin/companies'
        backLabel='Back to Companies'
        actions={
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setShowEditDialog(true)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
        }
      />

      {/* Kiosk sign-off link */}
      <div className='rounded-md border p-4 space-y-2'>
        <h2 className='text-sm font-semibold'>Kiosk Sign-off Link</h2>
        <p className='text-sm text-muted-foreground'>
          Share this URL with no-email workers so they can sign off documents
          without a login. Post it as a QR code or on a shared device.
        </p>
        <div className='flex items-center gap-2'>
          <code className='flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all'>
            {kioskUrl}
          </code>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              navigator.clipboard.writeText(kioskUrl)
              toast({ title: 'Copied', description: 'Kiosk URL copied.' })
            }}
          >
            <Copy className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className='h-4 w-4' />
          </Button>
        </div>
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

        <DataTable
          columns={companyAssignmentColumns}
          data={assignments}
          emptyTitle='No templates assigned yet'
          emptyDescription='Click "Assign Template" to get started.'
        />
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
            <EmptyState
              title='No individual assignments yet'
              description='Use "Assign to User" to give specific users extra templates.'
            />
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
                  {user.email ? (
                    <span className='text-xs text-muted-foreground'>
                      {user.email}
                    </span>
                  ) : (
                    <span className='text-xs text-muted-foreground italic'>
                      No email — kiosk sign-off
                    </span>
                  )}
                </div>
                <DataTable
                  columns={makeUserAssignmentColumns(user.displayName)}
                  data={ua}
                  wrapperClassName=''
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company-created templates (P17 self-serve portal) — read-only */}
      {companyTemplates.length > 0 && (
        <div>
          <div className='mb-4'>
            <h2 className='text-xl font-semibold'>Company-Created Templates</h2>
            <p className='text-sm text-muted-foreground mt-1'>
              Created by this company&apos;s own admin via the self-serve
              portal. Read-only — managed by the company, not the consultancy.
            </p>
          </div>

          <DataTable columns={companyTemplateColumns} data={companyTemplates} />
        </div>
      )}

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

      {showQrModal && (
        <QrCodeModal
          url={kioskUrl}
          fileName={company.name}
          title='Kiosk Sign-off QR Code'
          description='Post this QR code at your workplace. Workers scan it to sign off documents without needing a login.'
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  )
}
