// src/app/api/documents/stats/route.ts
import { BlobServiceClient } from '@azure/storage-blob'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { parseFileName } from '@/lib/version-manager'

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

    // Count unique documents, excluding folder markers and deduplicating versions
    const uniqueDocuments = new Set<string>()
    for await (const blob of containerClient.listBlobsFlat()) {
      if (blob.name.endsWith('/.folder') || blob.name === '.folder') continue
      const { baseName, extension } = parseFileName(blob.name)
      uniqueDocuments.add(baseName + extension)
    }

    return NextResponse.json({
      totalDocuments: uniqueDocuments.size
    })
  } catch (error) {
    console.error('Error getting document stats:', error)
    return NextResponse.json(
      { error: 'Failed to get document stats' },
      { status: 500 }
    )
  }
}
