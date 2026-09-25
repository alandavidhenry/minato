// src/app/admin/companies/page.tsx
'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CreateCompanyDialog } from '@/components/admin/create-company-dialog'
import { EditCompanyDialog } from '@/components/admin/edit-company-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

interface Company {
  id: string
  name: string
  tenantId: string | null
  createdAt: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/companies')
      if (!response.ok) throw new Error('Failed to fetch companies')
      const data = await response.json()
      setCompanies(data.companies)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load companies.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"?\n\nThis will permanently delete the company and all files in their folder. This cannot be undone.`
      )
    )
      return

    try {
      const response = await fetch(`/api/admin/companies/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete company')
      }

      toast({ title: 'Success', description: `"${name}" deleted.` })
      fetchCompanies()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete company',
        variant: 'destructive'
      })
    }
  }

  function handleCompanyCreated() {
    fetchCompanies()
    setShowCreateDialog(false)
    toast({ title: 'Success', description: 'Company created successfully.' })
  }

  function handleCompanySaved() {
    fetchCompanies()
    setEditingCompany(null)
    toast({ title: 'Success', description: 'Company updated successfully.' })
  }

  const columns: ColumnDef<typeof dataTableFeatures, Company>[] = [
    {
      accessorKey: 'name',
      header: 'Company Name',
      cell: ({ row }) => (
        <Link
          href={`/admin/companies/${row.original.id}`}
          className='font-medium hover:underline'
        >
          {row.original.name}
        </Link>
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
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row }) => (
        <>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setEditingCompany(row.original)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handleDelete(row.original.id, row.original.name)}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </>
      )
    }
  ]

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Client Companies'
        description='The businesses you manage health and safety compliance for.'
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Add Company
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
        isLoading={isLoading}
        emptyTitle='No companies yet'
        emptyDescription='Add your first client company.'
      />

      <CreateCompanyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCompanyCreated={handleCompanyCreated}
      />

      <EditCompanyDialog
        open={editingCompany !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCompany(null)
        }}
        company={editingCompany}
        onCompanySaved={handleCompanySaved}
      />
    </div>
  )
}
