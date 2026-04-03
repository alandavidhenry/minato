import { describe, expect, it, vi } from 'vitest'

import {
  deleteFile,
  generateDownloadUrl,
  moveFile,
  renameFile
} from '../file-operations'

vi.mock('../../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({}),
  ActivityType: {
    DELETE: 'delete',
    RENAME: 'rename',
    MOVE: 'move'
  }
}))

function makeContainerClient() {
  const mockBlobClient = {
    exists: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
    getProperties: vi.fn(),
    generateSasUrl: vi.fn(),
    url: 'https://mock.blob.core.windows.net/container/file',
    beginCopyFromURL: vi.fn(),
    setMetadata: vi.fn().mockResolvedValue({})
  }

  const containerClient = {
    getBlobClient: vi.fn(() => mockBlobClient)
  }

  return { containerClient, mockBlobClient }
}

describe('deleteFile', () => {
  it('deletes the file and returns success when it exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(true)

    const result = await deleteFile(
      containerClient as never,
      'report.pdf',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    expect(mockBlobClient.delete).toHaveBeenCalledOnce()
  })

  it('returns a failure message when the file does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await deleteFile(
      containerClient as never,
      'ghost.pdf',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('ghost.pdf')
    expect(mockBlobClient.delete).not.toHaveBeenCalled()
  })

  it('returns a failure on unexpected errors', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(true)
    mockBlobClient.delete.mockRejectedValue(new Error('network error'))

    const result = await deleteFile(
      containerClient as never,
      'report.pdf',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
  })
})

describe('renameFile', () => {
  it('returns failure for an invalid new name', async () => {
    const { containerClient } = makeContainerClient()

    const result = await renameFile(
      containerClient as never,
      'report.pdf',
      'bad*name',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Invalid')
  })

  it('returns failure when the source does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await renameFile(
      containerClient as never,
      'ghost.pdf',
      'new-name',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('ghost.pdf')
  })

  it('returns failure when the destination already exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    // source exists, dest also exists
    mockBlobClient.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    const result = await renameFile(
      containerClient as never,
      'report.pdf',
      'other',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('already exists')
  })

  it('renames the file successfully', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists
      .mockResolvedValueOnce(true) // source exists
      .mockResolvedValueOnce(false) // dest does not exist
    mockBlobClient.getProperties.mockResolvedValue({ metadata: null })
    const mockPoller = {
      pollUntilDone: vi.fn().mockResolvedValue({ copyStatus: 'success' })
    }
    mockBlobClient.beginCopyFromURL.mockResolvedValue(mockPoller)

    const result = await renameFile(
      containerClient as never,
      'folder/report.pdf',
      'summary',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    expect(result.data?.newPath).toBe('folder/summary.pdf')
    expect(mockBlobClient.delete).toHaveBeenCalledOnce()
  })
})

describe('generateDownloadUrl', () => {
  it('returns a SAS URL when the file exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(true)
    mockBlobClient.generateSasUrl.mockResolvedValue('https://sas.url')

    const url = await generateDownloadUrl(
      containerClient as never,
      'report.pdf'
    )

    expect(url).toBe('https://sas.url')
  })

  it('returns null when the file does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const url = await generateDownloadUrl(containerClient as never, 'ghost.pdf')
    expect(url).toBeNull()
  })
})

describe('moveFile', () => {
  it('returns failure when the source does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await moveFile(
      containerClient as never,
      'ghost.pdf',
      'folder',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('ghost.pdf')
  })

  it('returns failure when the destination already exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    const result = await moveFile(
      containerClient as never,
      'report.pdf',
      'folder',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
  })

  it('moves the file successfully', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists
      .mockResolvedValueOnce(true) // source exists
      .mockResolvedValueOnce(false) // dest does not exist
    mockBlobClient.getProperties.mockResolvedValue({ metadata: null })
    const mockPoller = {
      pollUntilDone: vi.fn().mockResolvedValue({ copyStatus: 'success' })
    }
    mockBlobClient.beginCopyFromURL.mockResolvedValue(mockPoller)

    const result = await moveFile(
      containerClient as never,
      'report.pdf',
      'archive',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    expect(result.data?.targetPath).toBe('archive/report.pdf')
    expect(mockBlobClient.delete).toHaveBeenCalledOnce()
  })
})
