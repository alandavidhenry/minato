// src/app/customer/documents/[assignmentId]/complete/page.tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import type { ComprehensionQuestionForClient } from '@/types/comprehension-question'
import type { FormField, FormSchema } from '@/types/form-schema'

function isFieldVisible(
  field: FormField,
  values: Record<string, unknown>
): boolean {
  if (!field.condition) return true
  return (values[field.condition.fieldId] === true) === field.condition.value
}

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

  function setAnswer(questionId: string, value: string) {
    setAnswerValues((prev) => ({ ...prev, [questionId]: value }))
    setFailedQuestionIds((prev) => prev.filter((id) => id !== questionId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
          body: JSON.stringify({ formData: visibleFormData, answers })
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
                <div key={field.id} className='grid gap-2'>
                  {field.type === 'checkbox' ? (
                    <div className='flex items-start gap-3'>
                      <Checkbox
                        id={field.id}
                        checked={formValues[field.id] === true}
                        onCheckedChange={(checked) =>
                          setValue(field.id, checked === true)
                        }
                        disabled={isSubmitting}
                        className='mt-0.5'
                      />
                      <Label htmlFor={field.id} className='cursor-pointer'>
                        {field.label}
                        {field.required && (
                          <span className='ml-1 text-destructive'>*</span>
                        )}
                      </Label>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor={field.id}>
                        {field.label}
                        {field.required && (
                          <span className='ml-1 text-destructive'>*</span>
                        )}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={field.id}
                          value={(formValues[field.id] as string) ?? ''}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          disabled={isSubmitting}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={field.id}
                          type={field.type === 'date' ? 'date' : 'text'}
                          value={(formValues[field.id] as string) ?? ''}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          disabled={isSubmitting}
                        />
                      )}
                    </>
                  )}
                </div>
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
