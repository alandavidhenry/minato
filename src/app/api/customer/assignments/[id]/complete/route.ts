// src/app/api/customer/assignments/[id]/complete/route.ts
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
import { generateVersionId } from '@/lib/version-manager'
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormField } from '@/types/form-schema'
import { CUSTOMER_ROLES } from '@/types/rbac'

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

  // Store in the company's Completed Forms folder so it appears in My Files.
  // Always use a versioned filename so re-completions group as new versions.
  // Fall back to the internal completions path if no company folder is set.
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
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!roles.some((r) => CUSTOMER_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  const customerCompanyId = session?.user?.customerCompanyId
  const userId = session?.user?.id
  const signerName = session?.user?.name ?? 'Unknown'
  const signerEmail = session?.user?.email ?? ''

  if (!customerCompanyId || !userId) {
    return NextResponse.json(
      { error: 'No company associated with this account.' },
      { status: 403 }
    )
  }

  try {
    const { id: assignmentId } = await params

    const assignment = await getAssignmentWithTemplate(assignmentId)

    if (!assignment || assignment.customerCompanyId !== customerCompanyId) {
      return NextResponse.json(
        { error: 'Assignment not found.' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const formData: Record<string, unknown> = body.formData ?? {}
    const submittedAnswers: { id: string; answer: string }[] =
      body.answers ?? []
    const declarationName: string = (body.declarationName ?? '').trim()

    if (!declarationName) {
      return NextResponse.json(
        { error: 'Declaration name is required.' },
        { status: 400 }
      )
    }

    // Validate comprehension answers — fetch full template to get correct answers
    const templateRecord = await getDocumentTemplateById(assignment.templateId)
    const questions =
      (templateRecord?.questions as ComprehensionQuestion[] | null) ?? []

    if (questions.length > 0) {
      const failedQuestionIds = questions
        .filter((q) => {
          const submitted = submittedAnswers.find((a) => a.id === q.id)
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

    // Validate required fields defined in the template's form schema,
    // skipping fields whose condition is not met (they were hidden from the customer)
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

    // Only persist values for visible fields (hidden fields were never shown)
    const visibleFormData = Object.fromEntries(
      schema
        .filter((field) => isFieldVisible(field, formData))
        .map((field) => [field.id, formData[field.id]])
    )

    // Create the completion record first so it is always persisted
    const record = await createCompletionRecord({
      assignmentId,
      signedById: userId,
      formData:
        Object.keys(visibleFormData).length > 0 ? visibleFormData : undefined
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Failed to record completion' },
        { status: 500 }
      )
    }

    // Generate and upload PDF; non-fatal if it fails
    try {
      const company = await getCustomerCompanyById(customerCompanyId)
      const visibleSchema = schema.filter((f) =>
        isFieldVisible(f, visibleFormData)
      )
      const pdfBuffer = await generateCompletionPDF({
        templateTitle: assignment.template.title,
        signerName,
        signerEmail,
        signedAt: new Date(record.signedAt),
        companyName: company?.name ?? 'Unknown Company',
        formSchema: visibleSchema,
        formData: visibleFormData,
        declarationName
      })
      const blobPath = await uploadPdfToBlob(
        record.id,
        pdfBuffer,
        company?.folderPath ?? null,
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
    console.error('Error recording completion:', error)
    return NextResponse.json(
      { error: 'Failed to record completion' },
      { status: 500 }
    )
  }
}
