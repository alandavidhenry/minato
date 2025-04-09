// src/app/api/documents/upload/route.ts
import { BlobServiceClient } from '@azure/storage-blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import {
  parseFileName,
  createVersionedFileName,
  generateVersionId
} from '@/lib/version-manager'

export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const isNewVersion = formData.get('isNewVersion') === 'true'
    const originalFileName = formData.get('originalFileName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (optional)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: 'File size exceeds 50MB limit'
        },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Azure Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME!
    )

    let fileName = file.name

    if (isNewVersion && originalFileName) {
      // This is a new version of an existing file
      const { baseName, extension } = parseFileName(originalFileName)
      const versionId = generateVersionId()
      fileName = createVersionedFileName(`${baseName}${extension}`, versionId)
    } else {
      // Check if file already exists and make it a version if it does
      const blobClient = containerClient.getBlockBlobClient(fileName)
      const exists = await blobClient.exists()

      if (exists) {
        const versionId = generateVersionId()
        fileName = createVersionedFileName(fileName, versionId)
      }
    }

    const uploadBlobClient = containerClient.getBlockBlobClient(fileName)
    await uploadBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: file.type || 'application/octet-stream'
      }
    })

    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? 'Unknown user',
        fileName,
        activityType: isNewVersion
          ? ActivityType.NEW_VERSION
          : ActivityType.UPLOAD,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          undefined
      })
    }

    return NextResponse.json({
      message: 'File uploaded successfully',
      fileName: fileName,
      isVersion: isNewVersion || fileName !== file.name
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
