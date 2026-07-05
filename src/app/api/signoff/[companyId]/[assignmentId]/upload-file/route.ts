// src/app/api/signoff/[companyId]/[assignmentId]/upload-file/route.ts
// Public endpoint — no authentication required, mirrors the authenticated
// upload route above. Requires workerId so the upload can be scoped/validated
// exactly like the kiosk completion POST.
import { BlobServiceClient } from '@azure/storage-blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentWithTemplate } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { getCustomerCompanyById } from '@/lib/customer-companies'
import { getUserById } from '@/lib/user-database'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim()
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

    const body = await request.formData()
    const file = body.get('file') as File | null
    const fieldId = body.get('fieldId')
    const workerId = body.get('workerId')

    if (
      !file ||
      typeof fieldId !== 'string' ||
      !fieldId ||
      typeof workerId !== 'string' ||
      !workerId
    ) {
      return NextResponse.json(
        { error: 'Missing required field: file, fieldId and workerId' },
        { status: 400 }
      )
    }

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

    if (assignment.userId && assignment.userId !== workerId) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      )
    }

    const schema = assignment.template.formSchema ?? []
    const field = schema.find((f) => f.id === fieldId)
    if (!field || field.type !== 'file') {
      return NextResponse.json(
        { error: 'Invalid field for file upload.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds the 10MB upload limit.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    )
    const sanitizedName = sanitizeFilename(file.name)
    const blobPath = `form-uploads/${assignmentId}/${workerId}/${fieldId}-${Date.now()}-${sanitizedName}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: file.type || 'application/octet-stream'
      }
    })

    return NextResponse.json({ blobPath, fileName: file.name })
  } catch (error) {
    console.error('Error uploading kiosk form field file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
