// src/app/customer/documents/page.tsx
'use client'

import { CheckCircle2, Clock, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'

interface Template {
  id: string
  title: string
  description: string | null
  blobPath: string | null
}

interface Assignment {
  id: string
  templateId: string
  customerCompanyId: string
  createdAt: string
  template: Template
}

interface Completion {
  id: string
  assignmentId: string
  signedAt: string
}

export default function CustomerDocumentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [assignmentsRes, completionsRes] = await Promise.all([
        fetch('/api/customer/assignments'),
        fetch('/api/customer/completions')
      ])

      if (!assignmentsRes.ok || !completionsRes.ok) {
        throw new Error('Failed to load documents')
      }

      const [assignmentsData, completionsData] = await Promise.all([
        assignmentsRes.json(),
        completionsRes.json()
      ])

      setAssignments(assignmentsData.assignments)
      setCompletions(completionsData.completions)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load your documents.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownload(assignmentId: string) {
    setDownloading(assignmentId)
    try {
      const response = await fetch(
        `/api/customer/assignments/${assignmentId}/download`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get download link')
      }

      const { url } = await response.json()
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to download',
        variant: 'destructive'
      })
    } finally {
      setDownloading(null)
    }
  }

  async function handleComplete(assignmentId: string) {
    setCompleting(assignmentId)
    try {
      const response = await fetch(
        `/api/customer/assignments/${assignmentId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to record completion')
      }

      toast({ title: 'Completed', description: 'Document marked as complete.' })
      fetchData()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to record completion',
        variant: 'destructive'
      })
    } finally {
      setCompleting(null)
    }
  }

  function isCompleted(assignmentId: string) {
    return completions.some((c) => c.assignmentId === assignmentId)
  }

  function lastCompletedAt(assignmentId: string) {
    const record = completions.find((c) => c.assignmentId === assignmentId)
    if (!record) return null
    return new Date(record.signedAt).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>Loading your documents...</p>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>
          No documents have been assigned to your company yet.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6 p-6'>
      <h1 className='text-3xl font-bold'>My Documents</h1>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {assignments.map((assignment) => {
          const completed = isCompleted(assignment.id)
          const completedDate = lastCompletedAt(assignment.id)

          return (
            <Card key={assignment.id}>
              <CardHeader className='pb-2'>
                <div className='flex items-start justify-between gap-2'>
                  <CardTitle className='text-base'>
                    {assignment.template.title}
                  </CardTitle>
                  <Badge variant={completed ? 'default' : 'secondary'}>
                    {completed ? (
                      <>
                        <CheckCircle2 className='mr-1 h-3 w-3' />
                        Complete
                      </>
                    ) : (
                      <>
                        <Clock className='mr-1 h-3 w-3' />
                        Pending
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                {assignment.template.description && (
                  <p className='text-sm text-muted-foreground'>
                    {assignment.template.description}
                  </p>
                )}

                {completed && completedDate && (
                  <p className='text-xs text-muted-foreground'>
                    Last completed: {completedDate}
                  </p>
                )}

                <div className='flex gap-2'>
                  {assignment.template.blobPath && (
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={downloading === assignment.id}
                      onClick={() => handleDownload(assignment.id)}
                      className='flex-1'
                    >
                      <Download className='mr-1 h-3 w-3' />
                      {downloading === assignment.id
                        ? 'Preparing...'
                        : 'Download'}
                    </Button>
                  )}

                  <Button
                    size='sm'
                    variant={completed ? 'outline' : 'default'}
                    disabled={completing === assignment.id}
                    onClick={() => handleComplete(assignment.id)}
                    className='flex-1'
                  >
                    {completing === assignment.id
                      ? 'Recording...'
                      : completed
                        ? 'Re-complete'
                        : 'Mark Complete'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
