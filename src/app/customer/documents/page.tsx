// src/app/customer/documents/page.tsx
'use client'

import { CheckCircle2, Clock, Download, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { WelcomeHeader } from '@/components/customer/welcome-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import type {
  DocumentTemplateSourceType,
  DocumentTemplateUploadMode
} from '@/types/document-template'
import type { FormField } from '@/types/form-schema'

interface Template {
  id: string
  title: string
  description: string | null
  blobPath: string | null
  formSchema: FormField[] | null
  sourceType: DocumentTemplateSourceType
  uploadMode: DocumentTemplateUploadMode | null
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
  blobPath: string | null
}

export default function CustomerDocumentsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

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

  async function handleDownloadPdf(completionId: string) {
    setDownloadingPdf(completionId)
    try {
      const response = await fetch(
        `/api/customer/completions/${completionId}/download`
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
          error instanceof Error ? error.message : 'Failed to download PDF',
        variant: 'destructive'
      })
    } finally {
      setDownloadingPdf(null)
    }
  }

  function isCompleted(assignmentId: string) {
    return completions.some((c) => c.assignmentId === assignmentId)
  }

  function getCompletion(assignmentId: string): Completion | undefined {
    return completions.find((c) => c.assignmentId === assignmentId)
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

  const pendingAssignments = assignments.filter((a) => !isCompleted(a.id))
  const completedAssignments = assignments.filter((a) => isCompleted(a.id))

  function renderCard(assignment: Assignment) {
    const completed = isCompleted(assignment.id)
    const completedDate = lastCompletedAt(assignment.id)
    const completion = getCompletion(assignment.id)
    const hasForm =
      assignment.template.formSchema &&
      assignment.template.formSchema.length > 0

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

          <div className='flex gap-2 flex-wrap'>
            {assignment.template.blobPath && (
              <Button
                size='sm'
                variant='outline'
                disabled={downloading === assignment.id}
                onClick={() => handleDownload(assignment.id)}
              >
                <Download className='mr-1 h-3 w-3' />
                {downloading === assignment.id ? 'Preparing...' : 'Template'}
              </Button>
            )}

            {completion?.blobPath && (
              <Button
                size='sm'
                variant='outline'
                disabled={downloadingPdf === completion.id}
                onClick={() => handleDownloadPdf(completion.id)}
              >
                <Download className='mr-1 h-3 w-3' />
                {downloadingPdf === completion.id ? 'Preparing...' : 'Your PDF'}
              </Button>
            )}

            <Button
              size='sm'
              variant={completed ? 'outline' : 'default'}
              onClick={() =>
                router.push(`/customer/documents/${assignment.id}/complete`)
              }
              className='flex-1'
            >
              {assignment.template.sourceType === 'upload' ? (
                <>
                  <FileText className='mr-1 h-3 w-3' />
                  {assignment.template.uploadMode === 'fill-and-return'
                    ? completed
                      ? 'Re-fill & Sign'
                      : 'Fill & Sign'
                    : completed
                      ? 'Re-read & Sign'
                      : 'Read & Sign'}
                </>
              ) : hasForm ? (
                <>
                  <FileText className='mr-1 h-3 w-3' />
                  {completed ? 'Re-complete' : 'Fill In & Complete'}
                </>
              ) : completed ? (
                'Re-complete'
              ) : (
                'Mark Complete'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const subtitle =
    pendingAssignments.length > 0
      ? `You have ${pendingAssignments.length} document${pendingAssignments.length === 1 ? '' : 's'} to complete.`
      : "You're all caught up."

  return (
    <div className='space-y-8 p-6'>
      <WelcomeHeader title='My Documents' subtitle={subtitle} />

      {pendingAssignments.length > 0 && (
        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>Pending</h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {pendingAssignments.map(renderCard)}
          </div>
        </section>
      )}

      {completedAssignments.length > 0 && (
        <section className='space-y-4'>
          <h2 className='text-xl font-semibold'>Complete</h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {completedAssignments.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  )
}
