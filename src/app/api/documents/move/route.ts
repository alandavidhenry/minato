// src/app/api/documents/move/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { logActivity, ActivityType } from '@/lib/activity-logger'
import { moveOrCopyFile } from '@/lib/folder-manager'

// POST: Move or copy a file
export async function POST(request: NextRequest) {
  // Check authentication
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // First get the document share URL
    const { filePath, targetPath, operation, newName } = await request.json()
    
    // Validate inputs
    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }
    
    // Validate operation
    if (operation !== 'move' && operation !== 'copy') {
      return NextResponse.json(
        { error: 'Invalid operation, must be "move" or "copy"' },
        { status: 400 }
      )
    }
    
    // Move or copy the file
    const newFilePath = await moveOrCopyFile(
      filePath, 
      targetPath || '', 
      operation,
      newName
    )
    
    if (!newFilePath) {
      return NextResponse.json(
        { error: `Failed to ${operation} file` },
        { status: 500 }
      )
    }
    
    // Log the activity
    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? 'Unknown user',
        fileName: newFilePath,
        activityType: operation === 'move' 
          ? ActivityType.UPLOAD 
          : ActivityType.NEW_VERSION,
        ipAddress:
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          undefined
      })
    }
    
    return NextResponse.json({ 
      filePath: newFilePath,
      message: `File ${operation === 'move' ? 'moved' : 'copied'} successfully` 
    })
  } catch (error: any) {
    const operation = error.operation ?? 'move'
    console.error(`Error ${operation === 'move' ? 'moving' : 'copying'} file:`, error)
    return NextResponse.json(
      { error: `Failed to ${operation === 'move' ? 'move' : 'copy'} file` },
      { status: 500 }
    )
  }
}