// src/app/admin/completions/page.tsx
'use client'

import { AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table/data-table'
import type { dataTableFeatures } from '@/components/ui/data-table/table-features'
import { toast } from '@/components/ui/use-toast'

import type { ColumnDef } from '@tanstack/react-table'

interface CompanyWithCount {
  id: string
  name: string
  completionCount: number
}

const columns: ColumnDef<typeof dataTableFeatures, CompanyWithCount>[] = [
  {
    accessorKey: 'name',
    header: 'Company',
    cell: ({ row }) => (
      <Link
        href={`/admin/completions/${row.original.id}`}
        className='flex items-center gap-2 font-medium'
      >
        <Building2 className='h-4 w-4 text-muted-foreground' />
        {row.original.name}
      </Link>
    )
  },
  {
    accessorKey: 'completionCount',
    header: 'Completions',
    cell: ({ row }) => (
      <Badge variant='secondary'>{row.original.completionCount}</Badge>
    )
  }
]

export default function CompletionsPage() {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/completions')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setCompanies(data.companies)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load completions.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Completions'
        description='Sign-off progress for every client company.'
        actions={
          <Link href='/admin/completions/outstanding'>
            <Button variant='surface'>
              <AlertTriangle className='mr-2 h-4 w-4' />
              View Outstanding
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
        isLoading={isLoading}
        emptyTitle='No completions yet'
        rowClassName={() => 'cursor-pointer'}
      />
    </div>
  )
}
