// src/app/api/customer/assignments/[id]/upload-file/route.ts
// Uploads a file selected for a 'file' form field during assignment
// completion. Returns the blob path + original filename to be stored in
// formData[fieldId] and submitted with the rest of the form on /complete.
import { BlobServiceClient } from '@azure/storage-blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { getAssignmentWithTemplate } from '@/lib/assignments'
import { authOptions } from '@/lib/auth'
import { CUSTOMER_ROLES } from '@/types/rbac'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim()
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

    const body = await request.formData()
    const file = body.get('file') as File | null
    const fieldId = body.get('fieldId')

    if (!file || typeof fieldId !== 'string' || !fieldId) {
      return NextResponse.json(
        { error: 'Missing required field: file and fieldId' },
        { status: 400 }
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
    const blobPath = `form-uploads/${assignmentId}/${userId}/${fieldId}-${Date.now()}-${sanitizedName}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: file.type || 'application/octet-stream'
      }
    })

    return NextResponse.json({ blobPath, fileName: file.name })
  } catch (error) {
    console.error('Error uploading form field file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
