// src/app/api/documents/stats/route.ts
import { BlobServiceClient } from '@azure/storage-blob'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Count all blobs
    let blobCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of containerClient.listBlobsFlat()) {
      blobCount++
    }

    return NextResponse.json({
      totalDocuments: blobCount
    })
  } catch (error) {
    console.error('Error getting document stats:', error)
    return NextResponse.json(
      { error: 'Failed to get document stats' },
      { status: 500 }
    )
  }
}
