// __tests__/lib/file-manager.test.ts

import { ActivityType } from '@/lib/activity-logger'
import { FileManager } from '@/lib/file-manager'

// Mock the Azure Storage Blob SDK
jest.mock('@azure/storage-blob', () => {
  // Create a mock implementation of a BlockBlobClient
  const mockBlockBlobClient = {
    upload: jest.fn().mockResolvedValue({})
  }

  // Create a mock implementation of a BlobClient
  const mockBlobClient = {
    exists: jest.fn().mockResolvedValue(false),
    getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
    delete: jest.fn().mockResolvedValue({}),
    getProperties: jest.fn().mockResolvedValue({
      metadata: {}
    }),
    beginCopyFromURL: jest.fn().mockResolvedValue({
      pollUntilDone: jest.fn().mockResolvedValue({
        copyStatus: 'success'
      })
    }),
    generateSasUrl: jest
      .fn()
      .mockResolvedValue('https://example.com/test.txt?sas'),
    url: 'https://example.com/test.txt'
  }

  // Mock the blob listing iterator
  const mockBlobList = function* () {
    yield {
      name: 'test/file1.txt',
      properties: {
        contentLength: 1024,
        contentType: 'text/plain',
        lastModified: new Date()
      }
    }
    yield {
      name: 'test/file2.txt',
      properties: {
        contentLength: 2048,
        contentType: 'text/plain',
        lastModified: new Date()
      }
    }
    yield {
      name: 'test/subfolder/file3.txt',
      properties: {
        contentLength: 4096,
        contentType: 'text/plain',
        lastModified: new Date()
      }
    }
    yield {
      name: 'test/.folder',
      properties: {
        contentLength: 0,
        contentType: 'application/x-directory',
        lastModified: new Date()
      }
    }
  }

  // Create a mock implementation of a ContainerClient
  const mockContainerClient = {
    getBlobClient: jest.fn().mockReturnValue(mockBlobClient),
    listBlobsFlat: jest.fn().mockImplementation(() => mockBlobList())
  }

  // Create a mock implementation of BlobServiceClient
  const mockBlobServiceClient = {
    getContainerClient: jest.fn().mockReturnValue(mockContainerClient)
  }

  // Return the full mock object structure
  return {
    BlobServiceClient: {
      fromConnectionString: jest.fn().mockReturnValue(mockBlobServiceClient)
    },
    BlobSASPermissions: {
      parse: jest.fn().mockReturnValue({})
    },
    SASProtocol: {
      Https: 'https'
    }
  }
})

// Mock the activity logger
jest.mock('@/lib/activity-logger', () => {
  return {
    logActivity: jest.fn().mockResolvedValue({}),
    ActivityType: {
      VIEW: 'view',
      DOWNLOAD: 'download',
      UPLOAD: 'upload',
      NEW_VERSION: 'new_version',
      RENAME: 'rename',
      DELETE: 'delete'
    }
  }
})

describe('FileManager', () => {
  let fileManager: FileManager

  beforeEach(() => {
    jest.clearAllMocks()
    fileManager = new FileManager('fake-connection-string', 'test-container')
  })

  // Test normalizePath method
  describe('normalizePath', () => {
    test('should handle empty path', () => {
      expect(fileManager.normalizePath('')).toBe('')
    })

    test('should handle root path', () => {
      expect(fileManager.normalizePath('/')).toBe('')
    })

    test('should remove leading and trailing slashes', () => {
      expect(fileManager.normalizePath('/test/')).toBe('test')
    })

    test('should handle nested paths', () => {
      expect(fileManager.normalizePath('/test/folder/')).toBe('test/folder')
    })

    test('should trim whitespace', () => {
      expect(fileManager.normalizePath('  test/folder  ')).toBe('test/folder')
    })
  })

  // Test folderExists method
  describe('folderExists', () => {
    test('should check for folder marker', async () => {
      // Set up mock to return true for a specific path
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(true)

      const result = await fileManager.folderExists('test-folder')

      // Check that getBlobClient was called with the right parameters
      const mockGetBlobClient = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient().getBlobClient

      expect(mockGetBlobClient).toHaveBeenCalledWith('test-folder/.folder')
      expect(result).toBe(true)
    })

    test('should return false when folder does not exist', async () => {
      // Set up mock to return false
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(false)

      const result = await fileManager.folderExists('non-existent-folder')

      expect(result).toBe(false)
    })
  })

  // Test createFolder method
  describe('createFolder', () => {
    test('should validate folder names', async () => {
      // Test with invalid name
      const result1 = await fileManager.createFolder(
        'test/*invalid',
        'user1',
        'Test User'
      )

      expect(result1.success).toBe(false)
      expect(result1.message).toContain('Invalid folder name')

      // Test with valid name
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(false) // Folder doesn't exist yet

      const result2 = await fileManager.createFolder(
        'valid-folder',
        'user1',
        'Test User'
      )

      expect(result2.success).toBe(true)

      // Check that upload was called
      const mockGetBlockBlobClient = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().getBlockBlobClient

      const mockUpload = mockGetBlockBlobClient().upload

      expect(mockUpload).toHaveBeenCalled()

      // Check that activity was logged
      const mockLogActivity = jest.requireMock(
        '@/lib/activity-logger'
      ).logActivity

      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'Test User',
        fileName: 'valid-folder',
        activityType: ActivityType.UPLOAD
      })
    })

    test('should not create folder if it already exists', async () => {
      // Mock folder exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(true) // Folder already exists

      const result = await fileManager.createFolder(
        'existing-folder',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('already exists')
    })
  })

  // Test listContent method
  describe('listContent', () => {
    test('should list files and folders', async () => {
      const contents = await fileManager.listContent('test')

      // Should have both files and folders
      expect(contents.length).toBeGreaterThan(0)

      // Check that we have at least one folder from the subfolder path
      const folders = contents.filter((item) => item.isFolder)
      expect(folders.length).toBeGreaterThan(0)

      // Check that we have files
      const files = contents.filter((item) => !item.isFolder)
      expect(files.length).toBeGreaterThan(0)
    })
  })

  // Test deleteFile method
  describe('deleteFile', () => {
    test('should delete an existing file', async () => {
      // Mock file exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(true)

      const result = await fileManager.deleteFile(
        'test/file.txt',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(true)

      // Check that delete was called
      const mockDelete = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().delete

      expect(mockDelete).toHaveBeenCalled()

      // Check that activity was logged
      const mockLogActivity = jest.requireMock(
        '@/lib/activity-logger'
      ).logActivity

      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'Test User',
        fileName: 'test/file.txt',
        activityType: ActivityType.DELETE
      })
    })

    test('should fail when file does not exist', async () => {
      // Mock file doesn't exist
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(false)

      const result = await fileManager.deleteFile(
        'non-existent.txt',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('does not exist')
    })
  })

  // Test deleteFolder method
  describe('deleteFolder', () => {
    test('should delete folder and contents', async () => {
      // Mock folder exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(true)

      const result = await fileManager.deleteFolder(
        'test-folder',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(true)

      // Check that delete was called
      const mockDelete = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().delete

      expect(mockDelete).toHaveBeenCalled()

      // Check that activity was logged
      const mockLogActivity = jest.requireMock(
        '@/lib/activity-logger'
      ).logActivity

      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'Test User',
        fileName: 'test-folder',
        activityType: ActivityType.DELETE
      })
    })

    test('should fail when folder does not exist', async () => {
      // Mock folder doesn't exist
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(false)

      const result = await fileManager.deleteFolder(
        'non-existent-folder',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('does not exist')
    })
  })

  // Test renameFile method
  describe('renameFile', () => {
    test('should rename an existing file', async () => {
      // Mock file exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      // First call: source exists, second call: destination doesn't exist
      mockBlobExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const result = await fileManager.renameFile(
        'test/old-name.txt',
        'new-name',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(true)

      // Check that copy and delete were called
      const mockBeginCopyFromURL = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().beginCopyFromURL

      const mockDelete = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().delete

      expect(mockBeginCopyFromURL).toHaveBeenCalled()
      expect(mockDelete).toHaveBeenCalled()

      // Check that activity was logged
      const mockLogActivity = jest.requireMock(
        '@/lib/activity-logger'
      ).logActivity

      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'Test User',
        fileName: expect.any(String), // new path
        activityType: ActivityType.RENAME
      })
    })

    test('should validate file names', async () => {
      const result = await fileManager.renameFile(
        'test/file.txt',
        '*invalid?',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid file name')
    })
  })

  // Test renameFolder method
  describe('renameFolder', () => {
    test('should rename an existing folder', async () => {
      // Mock folder exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      // First call: source exists, second call: destination doesn't exist
      mockBlobExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const result = await fileManager.renameFolder(
        'test/old-folder',
        'new-folder',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(true)

      // Check that activity was logged
      const mockLogActivity = jest.requireMock(
        '@/lib/activity-logger'
      ).logActivity

      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user1',
        userName: 'Test User',
        fileName: expect.any(String), // new path
        activityType: ActivityType.RENAME
      })
    })

    test('should validate folder names', async () => {
      const result = await fileManager.renameFolder(
        'test/folder',
        '*invalid?',
        'user1',
        'Test User'
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid folder name')
    })
  })

  // Test generateDownloadUrl method
  describe('generateDownloadUrl', () => {
    test('should generate a download URL for an existing file', async () => {
      // Mock file exists
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(true)

      const url = await fileManager.generateDownloadUrl('test/file.txt')

      expect(url).toBe('https://example.com/test.txt?sas')

      // Check that generateSasUrl was called
      const mockGenerateSasUrl = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().generateSasUrl

      expect(mockGenerateSasUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: expect.anything(),
          expiresOn: expect.any(Date),
          contentDisposition: expect.stringContaining('attachment'),
          protocol: 'https'
        })
      )
    })

    test('should return null for non-existent file', async () => {
      // Mock file doesn't exist
      const mockBlobExists = jest
        .requireMock('@azure/storage-blob')
        .BlobServiceClient.fromConnectionString()
        .getContainerClient()
        .getBlobClient().exists

      mockBlobExists.mockResolvedValueOnce(false)

      const url = await fileManager.generateDownloadUrl('non-existent.txt')

      expect(url).toBeNull()
    })
  })
})
