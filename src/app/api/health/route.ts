// src/app/api/health/route.ts
import { BlobServiceClient } from '@azure/storage-blob'
import { NextResponse } from 'next/server'

import prisma from '@/lib/prisma'

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
    const containerName =
      process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'documents'
    const client = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = client.getContainerClient(containerName)
    await containerClient.getProperties()
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [db, storage] = await Promise.all([checkDatabase(), checkStorage()])

  const checks = {
    db: db ? 'ok' : 'error',
    storage: storage ? 'ok' : 'error'
  }
  const allOk = db && storage

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks },
    { status: allOk ? 200 : 503 }
  )
}
