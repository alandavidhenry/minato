'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { FormFieldRenderer } from '@/components/form-field-renderer'
import { SignaturePad } from '@/components/signature-pad'
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

interface KioskAssignment {
  id: string
  template: AssignmentTemplate
}

interface KioskWorker {
  id: string
  displayName: string
  assignments: KioskAssignment[]
}

export default function KioskCompletePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const companyId = params.companyId as string
  const assignmentId = params.assignmentId as string
  const workerId = searchParams.get('workerId') ?? ''

  const [assignment, setAssignment] = useState<KioskAssignment | null>(null)
  const [workerName, setWorkerName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({})
  const [failedQuestionIds, setFailedQuestionIds] = useState<string[]>([])
  const [declarationName, setDeclarationName] = useState('')
  const [declarationError, setDeclarationError] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureError, setSignatureError] = useState(false)

  useEffect(() => {
    if (!workerId) {
      router.push(`/signoff/${companyId}`)
      return
    }

    fetch(`/api/signoff/${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        const worker = (data.workers ?? []).find(
          (w: KioskWorker) => w.id === workerId
        )
        if (!worker) {
          router.push(`/signoff/${companyId}`)
          return
        }
        setWorkerName(worker.displayName)
        const found = worker.assignments.find(
          (a: KioskAssignment) => a.id === assignmentId
        )
        if (!found) {
          router.push(`/signoff/${companyId}`)
          return
        }
        setAssignment(found)
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Could not load this document.',
          variant: 'destructive'
        })
        router.push(`/signoff/${companyId}`)
      })
      .finally(() => setIsLoading(false))
  }, [companyId, assignmentId, workerId, router])

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
    body.append('workerId', workerId)

    const res = await fetch(
      `/api/signoff/${companyId}/${assignmentId}/upload-file`,
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
      setDeclarationError(true)
      return
    }

    if (!signatureDataUrl) {
      setSignatureError(true)
      toast({
        title: 'Signature required',
        description: 'Please sign in the box before submitting.',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)

    try {
      const fields: FormField[] = assignment?.template.formSchema ?? []
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

      const res = await fetch(`/api/signoff/${companyId}/${assignmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          formData: visibleFormData,
          answers,
          declarationName: declarationName.trim(),
          signatureDataUrl
        })
      })

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

      setIsDone(true)
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

  if (status === 'loading' || isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <p className='text-muted-foreground'>Loading document...</p>
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen gap-4 text-center p-6'>
        <h1 className='text-2xl font-bold'>Access denied</h1>
        <p className='text-muted-foreground max-w-sm'>
          This kiosk is for workers without a Minato platform account. Please
          sign out before using the kiosk sign-off page.
        </p>
        <Button
          variant='outline'
          onClick={() => router.push('/api/auth/signout')}
        >
          Sign out
        </Button>
      </div>
    )
  }

  if (isDone) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen gap-4 text-center p-6'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>Signed off</h1>
          <p className='text-muted-foreground'>
            {workerName} has signed off on{' '}
            <strong>{assignment?.template.title}</strong>.
          </p>
        </div>
        <Button onClick={() => router.push(`/signoff/${companyId}`)}>
          Back to sign-off page
        </Button>
      </div>
    )
  }

  if (!assignment) return null

  const fields: FormField[] = assignment.template.formSchema ?? []
  const comprehensionQuestions: ComprehensionQuestionForClient[] =
    assignment.template.questions ?? []

  return (
    <div className='max-w-2xl mx-auto space-y-6 p-6 pt-12'>
      <div>
        <p className='text-sm text-muted-foreground'>
          Signing off as <strong>{workerName}</strong>
        </p>
        <h1 className='text-3xl font-bold mt-1'>{assignment.template.title}</h1>
        {assignment.template.description && (
          <p className='mt-1 text-muted-foreground'>
            {assignment.template.description}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {fields.length === 0 ? (
          <p className='text-muted-foreground'>
            This document has no form fields. Click below to confirm you have
            read and understood this document.
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
              requirements.
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
                setDeclarationError(false)
              }}
              disabled={isSubmitting}
              placeholder='Type your full name to sign'
            />
            {declarationError && (
              <p className='text-xs text-destructive'>
                Please enter your full name to confirm this declaration.
              </p>
            )}
          </div>
          <div className='grid gap-2'>
            <Label className={signatureError ? 'text-destructive' : undefined}>
              Signature
              <span className='ml-1 text-destructive'>*</span>
            </Label>
            <SignaturePad
              onChange={(dataUrl) => {
                setSignatureDataUrl(dataUrl)
                if (dataUrl) setSignatureError(false)
              }}
              disabled={isSubmitting}
              error={signatureError}
            />
            {signatureError && (
              <p className='text-xs text-destructive'>
                Please sign in the box before submitting.
              </p>
            )}
          </div>
        </div>

        <div className='flex gap-3'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.push(`/signoff/${companyId}`)}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Sign off document'}
          </Button>
        </div>
      </form>
    </div>
  )
}
