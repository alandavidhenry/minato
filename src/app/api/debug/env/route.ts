// src/app/api/debug/env/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    // Don't include the actual connection string in the response, just check if it exists
    connectionString: {
      exists: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
      length: process.env.AZURE_STORAGE_CONNECTION_STRING?.length ?? 0,
      startsWithDefaultEndpoints:
        process.env.AZURE_STORAGE_CONNECTION_STRING?.startsWith(
          'DefaultEndpointsProtocol='
        ) || false
    },
    containerName: {
      exists: !!process.env.AZURE_STORAGE_CONTAINER_NAME,
      value: process.env.AZURE_STORAGE_CONTAINER_NAME
    }
  })
}
