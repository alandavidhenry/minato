'use client'

import { Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import type {
  DocumentTemplateSourceType,
  DocumentTemplateUploadMode
} from '@/types/document-template'

interface CreateTemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onTemplateCreated: () => void
  readonly apiBasePath?: string
}

interface UploadedDocument {
  blobPath: string
  originalBlobPath: string | null
  fileName: string
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onTemplateCreated,
  apiBasePath = '/api/admin/templates'
}: CreateTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '' })
  const [sourceType, setSourceType] =
    useState<DocumentTemplateSourceType>('form')
  const [uploadMode, setUploadMode] =
    useState<DocumentTemplateUploadMode>('read-only')
  const [uploadedDocument, setUploadedDocument] =
    useState<UploadedDocument | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function resetState() {
    setFormData({ title: '', description: '' })
    setSourceType('form')
    setUploadMode('read-only')
    setUploadedDocument(null)
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setIsUploadingFile(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(`${apiBasePath}/upload-document`, {
        method: 'POST',
        body
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      setUploadedDocument(await response.json())
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive'
      })
    } finally {
      setIsUploadingFile(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template title is required',
        variant: 'destructive'
      })
      return
    }

    if (sourceType === 'upload' && !uploadedDocument) {
      toast({
        title: 'Validation Error',
        description: 'Please upload a Word or PDF document',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(apiBasePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          sourceType,
          ...(sourceType === 'upload' &&
            uploadedDocument && {
              uploadMode,
              sourceDocBlobPath: uploadedDocument.blobPath,
              sourceDocOriginalBlobPath: uploadedDocument.originalBlobPath,
              sourceDocFileName: uploadedDocument.fileName
            })
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      onTemplateCreated()
      resetState()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create template',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Document Template</DialogTitle>
            <DialogDescription>
              Add a reusable H&amp;S document template to the library.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder='Farmyard Safety Checklist'
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>
                Description{' '}
                <span className='text-muted-foreground'>(optional)</span>
              </Label>
              <Input
                id='description'
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder='Brief description of the document'
                disabled={isLoading}
              />
            </div>

            <Separator />

            <div className='grid gap-2'>
              <Label>Document type</Label>
              <RadioGroup
                value={sourceType}
                onValueChange={(value) =>
                  setSourceType(value as DocumentTemplateSourceType)
                }
              >
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value='form' id='source-form' />
                  <Label
                    htmlFor='source-form'
                    className='cursor-pointer font-normal'
                  >
                    Build a form online
                  </Label>
                </div>
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value='upload' id='source-upload' />
                  <Label
                    htmlFor='source-upload'
                    className='cursor-pointer font-normal'
                  >
                    Upload a Word or PDF document
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {sourceType === 'upload' && (
              <>
                <div className='grid gap-2'>
                  <Label>How staff complete it</Label>
                  <RadioGroup
                    value={uploadMode}
                    onValueChange={(value) =>
                      setUploadMode(value as DocumentTemplateUploadMode)
                    }
                  >
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem value='read-only' id='mode-read-only' />
                      <Label
                        htmlFor='mode-read-only'
                        className='cursor-pointer font-normal'
                      >
                        Read-only — staff read and sign
                      </Label>
                    </div>
                    <div className='flex items-center gap-2'>
                      <RadioGroupItem
                        value='fill-and-return'
                        id='mode-fill-and-return'
                      />
                      <Label
                        htmlFor='mode-fill-and-return'
                        className='cursor-pointer font-normal'
                      >
                        Fill in and return — staff download, complete, and
                        upload it back
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className='grid gap-2'>
                  <Label>Document</Label>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    className='hidden'
                    onChange={handleFileSelected}
                    disabled={isUploadingFile || isLoading}
                  />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile || isLoading}
                  >
                    {isUploadingFile ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Uploading &amp; converting...
                      </>
                    ) : (
                      <>
                        <Upload className='mr-2 h-4 w-4' />
                        {uploadedDocument ? 'Replace file' : 'Choose file'}
                      </>
                    )}
                  </Button>
                  {uploadedDocument && (
                    <p className='text-sm text-muted-foreground'>
                      {uploadedDocument.fileName}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type='submit' disabled={isLoading || isUploadingFile}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create Template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
