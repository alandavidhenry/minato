import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createFolder,
  deleteFolder,
  folderExists,
  renameFolder
} from '../folder-operations'

vi.mock('../../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({}),
  ActivityType: {
    UPLOAD: 'upload',
    DELETE: 'delete',
    RENAME: 'rename',
    MOVE: 'move',
    VIEW: 'view',
    DOWNLOAD: 'download',
    NEW_VERSION: 'new_version'
  }
}))

function asyncOf<T>(...items: T[]) {
  return (async function* () {
    for (const item of items) yield item
  })()
}

function makeContainerClient() {
  const mockBlockBlobClient = {
    upload: vi.fn().mockResolvedValue({})
  }

  const mockBlobClient = {
    exists: vi.fn(),
    delete: vi.fn().mockResolvedValue({}),
    getBlockBlobClient: vi.fn(() => mockBlockBlobClient),
    beginCopyFromURL: vi.fn()
  }

  const containerClient = {
    getBlobClient: vi.fn(() => mockBlobClient),
    listBlobsFlat: vi.fn(() => asyncOf())
  }

  return { containerClient, mockBlobClient, mockBlockBlobClient }
}

describe('folderExists', () => {
  it('returns true when the folder marker blob exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(true)

    expect(await folderExists(containerClient as never, 'Reports')).toBe(true)
    expect(containerClient.getBlobClient).toHaveBeenCalledWith('Reports/.folder')
  })

  it('returns false when the folder marker blob does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    expect(await folderExists(containerClient as never, 'Reports')).toBe(false)
  })
})

describe('createFolder', () => {
  it('returns failure for an invalid folder name', async () => {
    const { containerClient } = makeContainerClient()

    const result = await createFolder(
      containerClient as never,
      'bad*name',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Invalid')
  })

  it('returns failure when the folder already exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(true)

    const result = await createFolder(
      containerClient as never,
      'Reports',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('already exists')
  })

  it('creates the folder marker and returns success', async () => {
    const { containerClient, mockBlobClient, mockBlockBlobClient } =
      makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await createFolder(
      containerClient as never,
      'Reports',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    expect(result.data?.path).toBe('Reports')
    expect(mockBlockBlobClient.upload).toHaveBeenCalledOnce()
  })
})

describe('deleteFolder', () => {
  it('returns failure when the folder does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await deleteFolder(
      containerClient as never,
      'Ghost',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Ghost')
  })

  it('deletes all blobs in the folder and returns success', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    // First exists() call is for the marker (folder exists check) → true
    // Second exists() call is for the marker deletion check → true
    mockBlobClient.exists.mockResolvedValue(true)
    containerClient.listBlobsFlat.mockReturnValue(
      asyncOf({ name: 'Reports/file.pdf' }, { name: 'Reports/other.pdf' })
    )

    const result = await deleteFolder(
      containerClient as never,
      'Reports',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    // 2 blobs + 1 marker = 3 deletions
    expect(mockBlobClient.delete).toHaveBeenCalledTimes(3)
  })
})

describe('renameFolder', () => {
  it('returns failure for an invalid new name', async () => {
    const { containerClient } = makeContainerClient()

    const result = await renameFolder(
      containerClient as never,
      'Reports',
      'bad|name',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Invalid')
  })

  it('returns failure when the source folder does not exist', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    mockBlobClient.exists.mockResolvedValue(false)

    const result = await renameFolder(
      containerClient as never,
      'Ghost',
      'NewName',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('Ghost')
  })

  it('renames an empty folder successfully', async () => {
    const { containerClient, mockBlobClient, mockBlockBlobClient } =
      makeContainerClient()
    // folderExists for source → true
    // folderExists for dest → false
    // marker exists for cleanup → true
    mockBlobClient.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    // listBlobsFlat returns no blobs (empty folder)
    containerClient.listBlobsFlat.mockReturnValue(asyncOf())

    const result = await renameFolder(
      containerClient as never,
      'OldName',
      'NewName',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(true)
    expect(result.data?.newPath).toBe('NewName')
    expect(mockBlockBlobClient.upload).toHaveBeenCalledOnce()
    expect(mockBlobClient.delete).toHaveBeenCalledOnce()
  })

  it('returns failure when a destination with the same name already exists', async () => {
    const { containerClient, mockBlobClient } = makeContainerClient()
    // source exists → true, dest exists → true
    mockBlobClient.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
    containerClient.listBlobsFlat.mockReturnValue(asyncOf())

    const result = await renameFolder(
      containerClient as never,
      'OldName',
      'ExistingFolder',
      'user-1',
      'Alice'
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('already exists')
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})
