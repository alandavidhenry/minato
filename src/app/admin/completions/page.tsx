// src/app/admin/completions/page.tsx
'use client'

import { AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { TableSkeleton } from '@/components/table-skeleton'
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

interface CompanyWithCount {
  id: string
  name: string
  completionCount: number
}

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

  function renderRows() {
    if (isLoading) {
      return <TableSkeleton columns={2} />
    }

    if (companies.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={2} className='p-0'>
            <EmptyState title='No completions yet' />
          </TableCell>
        </TableRow>
      )
    }

    return companies.map((company) => (
      <TableRow key={company.id} className='cursor-pointer hover:bg-muted/50'>
        <TableCell>
          <Link
            href={`/admin/completions/${company.id}`}
            className='flex items-center gap-2 font-medium'
          >
            <Building2 className='h-4 w-4 text-muted-foreground' />
            {company.name}
          </Link>
        </TableCell>
        <TableCell>
          <Badge variant='secondary'>{company.completionCount}</Badge>
        </TableCell>
      </TableRow>
    ))
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

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Completions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>
    </div>
  )
}
