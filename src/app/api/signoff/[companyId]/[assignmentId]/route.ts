// src/app/api/signoff/[companyId]/[assignmentId]/route.ts
// Public endpoint — no authentication required.
// Accepts a workerId (must be a no-email user in this company) and records the
// completion exactly like the authenticated customer flow.
import { BlobServiceClient } from '@azure/storage-blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentWithTemplate } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import {
  createCompletionRecord,
  updateCompletionBlobPath
} from '@/lib/completion-records'
import { getCustomerCompanyById } from '@/lib/customer-companies'
import { getDocumentTemplateById } from '@/lib/document-templates'
import { generateCompletionPDF } from '@/lib/pdf/completion-pdf'
import { getUserById } from '@/lib/user-database'
import { generateVersionId } from '@/lib/version-manager'
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormField } from '@/types/form-schema'

function isFieldVisible(
  field: FormField,
  formData: Record<string, unknown>
): boolean {
  if (!field.condition) return true
  return (formData[field.condition.fieldId] === true) === field.condition.value
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '-').trim()
}

async function uploadPdfToBlob(
  recordId: string,
  buffer: Buffer,
  companyFolderPath: string | null,
  templateTitle: string
): Promise<string> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  )
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER_NAME!
  )

  const blobPath = companyFolderPath
    ? `${companyFolderPath}/Completed Forms/${sanitizeFilename(templateTitle)}_v_${generateVersionId()}.pdf`
    : `completions/${recordId}.pdf`

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' }
  })
  return blobPath
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; assignmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (session) {
    return NextResponse.json(
      { error: 'Kiosk sign-off is not available to authenticated users.' },
      { status: 403 }
    )
  }

  try {
    const { companyId, assignmentId } = await params

    const company = await getCustomerCompanyById(companyId)
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      workerId,
      formData = {},
      answers = []
    } = body as {
      workerId?: string
      formData?: Record<string, unknown>
      answers?: { id: string; answer: string }[]
    }

    if (!workerId) {
      return NextResponse.json(
        { error: 'Missing required field: workerId' },
        { status: 400 }
      )
    }

    // Verify the worker is a no-email user belonging to this company
    const worker = await getUserById(workerId)
    if (
      !worker ||
      worker.customerCompanyId !== companyId ||
      worker.email !== null
    ) {
      return NextResponse.json(
        { error: 'Worker not found or not eligible for kiosk sign-off' },
        { status: 403 }
      )
    }

    const assignment = await getAssignmentWithTemplate(assignmentId)
    if (!assignment || assignment.customerCompanyId !== companyId) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    // If it's an individual assignment, it must belong to this worker
    if (assignment.userId && assignment.userId !== workerId) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    // Validate comprehension answers
    const templateRecord = await getDocumentTemplateById(assignment.templateId)
    const questions =
      (templateRecord?.questions as ComprehensionQuestion[] | null) ?? []

    if (questions.length > 0) {
      const failedQuestionIds = questions
        .filter((q) => {
          const submitted = answers.find((a) => a.id === q.id)
          if (!submitted) return true
          return (
            submitted.answer.trim().toLowerCase() !==
            q.answer.trim().toLowerCase()
          )
        })
        .map((q) => q.id)

      if (failedQuestionIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Incorrect answers to comprehension questions.',
            failedQuestionIds
          },
          { status: 400 }
        )
      }
    }

    // Validate required form fields
    const schema = assignment.template.formSchema ?? []
    const missingFields = schema
      .filter((field) => field.required && isFieldVisible(field, formData))
      .filter((field) => {
        const value = formData[field.id]
        if (field.type === 'checkbox') return value !== true
        return value === undefined || value === null || value === ''
      })
      .map((field) => field.label)

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Required fields missing: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const visibleFormData = Object.fromEntries(
      schema
        .filter((field) => isFieldVisible(field, formData))
        .map((field) => [field.id, formData[field.id]])
    )

    const record = await createCompletionRecord({
      assignmentId,
      signedById: workerId,
      formData:
        Object.keys(visibleFormData).length > 0 ? visibleFormData : undefined
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Failed to record completion' },
        { status: 500 }
      )
    }

    // Generate and upload PDF — non-fatal if it fails
    try {
      const visibleSchema = schema.filter((f) =>
        isFieldVisible(f, visibleFormData)
      )
      const pdfBuffer = await generateCompletionPDF({
        templateTitle: assignment.template.title,
        signerName: worker.displayName,
        signerEmail: '',
        signedAt: new Date(record.signedAt),
        companyName: company.name,
        formSchema: visibleSchema,
        formData: visibleFormData
      })
      const blobPath = await uploadPdfToBlob(
        record.id,
        pdfBuffer,
        company.folderPath ?? null,
        assignment.template.title
      )
      await updateCompletionBlobPath(record.id, blobPath)
      record.blobPath = blobPath
    } catch (pdfError) {
      console.error(
        'PDF generation failed (completion still recorded):',
        pdfError
      )
    }

    return NextResponse.json({ completion: record })
  } catch (error) {
    console.error('Error recording kiosk completion:', error)
    return NextResponse.json(
      { error: 'Failed to record completion' },
      { status: 500 }
    )
  }
}
