import { beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadSourceDocument } from '../document-upload'

const { mockConvertToPdf, mockUploadBlob } = vi.hoisted(() => ({
  mockConvertToPdf: vi.fn(),
  mockUploadBlob: vi.fn()
}))

vi.mock('../document-conversion', async () => {
  const actual = await vi.importActual('../document-conversion')
  return {
    ...actual,
    convertToPdf: mockConvertToPdf
  }
})

vi.mock('../storage', () => ({
  uploadBlob: mockUploadBlob
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AZURE_STORAGE_CONTAINER_NAME = 'documents'
  mockUploadBlob.mockResolvedValue(undefined)
})

describe('uploadSourceDocument', () => {
  it('uploads a PDF directly, with no separate original', async () => {
    const buffer = Buffer.from('%PDF-1.4 content')

    const result = await uploadSourceDocument({
      buffer,
      fileName: 'Fire Safety Policy.pdf',
      mimeType: 'application/pdf',
      pathPrefix: 'templates/template_123'
    })

    expect(mockConvertToPdf).not.toHaveBeenCalled()
    expect(mockUploadBlob).toHaveBeenCalledTimes(1)
    expect(mockUploadBlob).toHaveBeenCalledWith(
      'documents',
      'templates/template_123/source.pdf',
      buffer,
      'application/pdf'
    )
    expect(result).toEqual({
      blobPath: 'templates/template_123/source.pdf',
      originalBlobPath: null,
      fileName: 'Fire Safety Policy.pdf'
    })
  })

  it('converts a Word document and retains the original', async () => {
    const original = Buffer.from('docx content')
    const converted = Buffer.from('%PDF-1.4 converted')
    mockConvertToPdf.mockResolvedValue(converted)

    const result = await uploadSourceDocument({
      buffer: original,
      fileName: 'Fire Safety Policy.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pathPrefix: 'templates/template_123'
    })

    expect(mockConvertToPdf).toHaveBeenCalledWith(
      original,
      'Fire Safety Policy.docx'
    )
    expect(mockUploadBlob).toHaveBeenCalledTimes(2)
    expect(mockUploadBlob).toHaveBeenCalledWith(
      'documents',
      'templates/template_123/source.pdf',
      converted,
      'application/pdf'
    )
    expect(mockUploadBlob).toHaveBeenCalledWith(
      'documents',
      'templates/template_123/source-original-Fire Safety Policy.docx',
      original,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    expect(result).toEqual({
      blobPath: 'templates/template_123/source.pdf',
      originalBlobPath:
        'templates/template_123/source-original-Fire Safety Policy.docx',
      fileName: 'Fire Safety Policy.docx'
    })
  })

  it('sanitizes unsafe characters in the retained original filename', async () => {
    mockConvertToPdf.mockResolvedValue(Buffer.from('%PDF-1.4'))

    const result = await uploadSourceDocument({
      buffer: Buffer.from('docx content'),
      fileName: 'Fire/Safety:Policy?.docx',
      mimeType: 'application/msword',
      pathPrefix: 'templates/template_123'
    })

    expect(result.originalBlobPath).toBe(
      'templates/template_123/source-original-Fire-Safety-Policy-.docx'
    )
  })

  it('rejects unsupported file types', async () => {
    await expect(
      uploadSourceDocument({
        buffer: Buffer.from('not a document'),
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload',
        pathPrefix: 'templates/template_123'
      })
    ).rejects.toThrow(/unsupported/i)

    expect(mockUploadBlob).not.toHaveBeenCalled()
  })
})
