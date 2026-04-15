// src/app/admin/companies/page.tsx
'use client'

import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CreateCompanyDialog } from '@/components/admin/create-company-dialog'
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
  tenantId: string | null
  createdAt: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

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

  function renderRows() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={3} className='h-24 text-center'>
            Loading companies...
          </TableCell>
        </TableRow>
      )
    }

    if (companies.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={3} className='h-24 text-center'>
            No companies yet. Add your first client company.
          </TableCell>
        </TableRow>
      )
    }

    return companies.map((company) => (
      <TableRow key={company.id}>
        <TableCell className='font-medium'>
          <Link
            href={`/admin/companies/${company.id}`}
            className='hover:underline'
          >
            {company.name}
          </Link>
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {new Date(company.createdAt).toLocaleDateString()}
        </TableCell>
        <TableCell className='text-right'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => handleDelete(company.id, company.name)}
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
        <h1 className='text-3xl font-bold'>Client Companies</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Add Company
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>

      <CreateCompanyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCompanyCreated={handleCompanyCreated}
      />
    </div>
  )
}
