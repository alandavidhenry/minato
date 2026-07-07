// src/app/customer/documents/[assignmentId]/complete/page.tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { FormFieldRenderer } from '@/components/form-field-renderer'
import { useBreadcrumbLabel } from '@/components/providers/breadcrumb-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { isFieldVisible } from '@/lib/form-schema-utils'
import type { ComprehensionQuestionForClient } from '@/types/comprehension-question'
import type {
  FormField,
  FormSchema,
  UploadedFileValue
} from '@/types/form-schema'

interface AssignmentTemplate {
  id: string
  title: string
  description: string | null
  formSchema: FormSchema | null
  questions: ComprehensionQuestionForClient[] | null
}

interface Assignment {
  id: string
  template: AssignmentTemplate
}

export default function CompleteDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const assignmentId = params.assignmentId as string

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({})
  const [failedQuestionIds, setFailedQuestionIds] = useState<string[]>([])
  const { data: session } = useSession()
  const accountName = session?.user?.name ?? ''

  const [declarationName, setDeclarationName] = useState('')
  const [declarationError, setDeclarationError] = useState<string | null>(null)

  useBreadcrumbLabel(
    `/customer/documents/${assignmentId}`,
    assignment?.template.title
  )

  useEffect(() => {
    async function fetchAssignment() {
      try {
        const res = await fetch(`/api/customer/assignments/${assignmentId}`)
        if (!res.ok) throw new Error('Assignment not found')
        const data = await res.json()
        setAssignment(data.assignment)
      } catch {
        toast({
          title: 'Error',
          description: 'Could not load this document.',
          variant: 'destructive'
        })
        router.push('/customer/documents')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssignment()
  }, [assignmentId, router])

  function setValue(fieldId: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  async function uploadFieldFile(
    fieldId: string,
    file: File
  ): Promise<UploadedFileValue> {
    const body = new FormData()
    body.append('file', file)
    body.append('fieldId', fieldId)

    const res = await fetch(
      `/api/customer/assignments/${assignmentId}/upload-file`,
      { method: 'POST', body }
    )
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || 'Failed to upload file')
    }
    return res.json()
  }

  function setAnswer(questionId: string, value: string) {
    setAnswerValues((prev) => ({ ...prev, [questionId]: value }))
    setFailedQuestionIds((prev) => prev.filter((id) => id !== questionId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!declarationName.trim()) {
      setDeclarationError(
        'Please enter your full name to confirm this declaration.'
      )
      return
    }

    setIsSubmitting(true)

    try {
      // Only submit values for fields that are currently visible
      const visibleFormData = Object.fromEntries(
        fields
          .filter((f) => isFieldVisible(f, formValues))
          .map((f) => [f.id, formValues[f.id]])
      )

      const comprehensionQuestions = assignment?.template.questions ?? []
      const answers = comprehensionQuestions.map((q) => ({
        id: q.id,
        answer: answerValues[q.id] ?? ''
      }))

      const res = await fetch(
        `/api/customer/assignments/${assignmentId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formData: visibleFormData,
            answers,
            declarationName: declarationName.trim()
          })
        }
      )

      if (!res.ok) {
        const errorBody = await res.json()
        if (errorBody.failedQuestionIds) {
          setFailedQuestionIds(errorBody.failedQuestionIds)
          toast({
            title: 'Incorrect answers',
            description:
              'Please review your answers to the comprehension questions and try again.',
            variant: 'destructive'
          })
          return
        }
        if (errorBody.nameError) {
          setDeclarationError(
            'The name you entered does not match your account name. Please enter your name exactly as it appears in your account.'
          )
          return
        }
        throw new Error(errorBody.error || 'Failed to submit')
      }

      toast({ title: 'Submitted', description: 'Document marked as complete.' })
      router.push('/customer/documents')
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to submit',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-muted-foreground'>Loading document...</p>
      </div>
    )
  }

  if (!assignment) return null

  const fields: FormField[] = assignment.template.formSchema ?? []
  const comprehensionQuestions: ComprehensionQuestionForClient[] =
    assignment.template.questions ?? []

  return (
    <div className='max-w-2xl mx-auto space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>{assignment.template.title}</h1>
        {assignment.template.description && (
          <p className='mt-1 text-muted-foreground'>
            {assignment.template.description}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {fields.length === 0 ? (
          <p className='text-muted-foreground'>
            This document has no form fields. Click below to confirm completion.
          </p>
        ) : (
          <div className='space-y-5'>
            {fields
              .filter((f) => isFieldVisible(f, formValues))
              .map((field) => (
                <FormFieldRenderer
                  key={field.id}
                  field={field}
                  value={formValues[field.id]}
                  onChange={(value) => setValue(field.id, value)}
                  disabled={isSubmitting}
                  onUploadFile={(file) => uploadFieldFile(field.id, file)}
                />
              ))}
          </div>
        )}

        {comprehensionQuestions.length > 0 && (
          <>
            <Separator />
            <div className='space-y-4'>
              <div>
                <h2 className='text-lg font-semibold'>Comprehension Check</h2>
                <p className='text-sm text-muted-foreground'>
                  Answer the following questions to confirm you have read and
                  understood this document.
                </p>
              </div>
              {comprehensionQuestions.map((q, index) => {
                const failed = failedQuestionIds.includes(q.id)
                return (
                  <div key={q.id} className='grid gap-2'>
                    <Label className={failed ? 'text-destructive' : undefined}>
                      {index + 1}. {q.question}
                      <span className='ml-1 text-destructive'>*</span>
                    </Label>
                    <RadioGroup
                      value={answerValues[q.id] ?? ''}
                      onValueChange={(value) => setAnswer(q.id, value)}
                      disabled={isSubmitting}
                      className='gap-2'
                    >
                      {q.options.map((option) => (
                        <div key={option} className='flex items-center gap-2'>
                          <RadioGroupItem
                            value={option}
                            id={`cq-${q.id}-${option}`}
                          />
                          <Label
                            htmlFor={`cq-${q.id}-${option}`}
                            className='cursor-pointer font-normal'
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {failed && (
                      <p className='text-xs text-destructive'>
                        Incorrect answer — please try again.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <Separator />
        <div className='space-y-3'>
          <div>
            <h2 className='text-lg font-semibold'>Declaration</h2>
            <p className='text-sm text-muted-foreground'>
              By entering your full name below, you confirm that you have read
              and understood this document and agree to comply with its
              requirements. The name must match your account name exactly.
            </p>
          </div>
          <div className='grid gap-2'>
            <Label
              htmlFor='declaration-name'
              className={declarationError ? 'text-destructive' : undefined}
            >
              Full name
              <span className='ml-1 text-destructive'>*</span>
            </Label>
            <Input
              id='declaration-name'
              value={declarationName}
              onChange={(e) => {
                setDeclarationName(e.target.value)
                setDeclarationError(null)
              }}
              disabled={isSubmitting}
              placeholder={accountName || 'Type your full name to sign'}
            />
            {accountName && !declarationError && (
              <p className='text-xs text-muted-foreground'>
                Enter your name as it appears in your account: {accountName}
              </p>
            )}
            {declarationError && (
              <p className='text-xs text-destructive'>{declarationError}</p>
            )}
          </div>
        </div>

        <div className='flex gap-3'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.push('/customer/documents')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit & Complete'}
          </Button>
        </div>
      </form>
    </div>
  )
}
