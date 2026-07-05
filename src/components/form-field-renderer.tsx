'use client'

import { Loader2, Paperclip, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import type { FormField, UploadedFileValue } from '@/types/form-schema'

interface FormFieldRendererProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  /** Uploads the given file and resolves with its blob path + name. Omit to render the file input as preview-only (no real upload). */
  onUploadFile?: (file: File) => Promise<UploadedFileValue>
}

export function FormFieldRenderer({
  field,
  value,
  onChange,
  disabled,
  onUploadFile
}: FormFieldRendererProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (field.type === 'section') {
    return (
      <div className='pt-2'>
        <h3 className='text-base font-semibold border-b pb-1'>{field.label}</h3>
      </div>
    )
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onUploadFile) return
    setIsUploading(true)
    try {
      const uploaded = await onUploadFile(file)
      onChange(uploaded)
    } catch {
      toast({
        title: 'Upload failed',
        description: `Could not upload ${file.name}. Please try again.`,
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const uploadedFile = value as UploadedFileValue | undefined

  return (
    <div className='grid gap-2'>
      {field.type === 'checkbox' ? (
        <div className='flex items-start gap-3'>
          <Checkbox
            id={field.id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            disabled={disabled}
            className='mt-0.5'
          />
          <Label htmlFor={field.id} className='cursor-pointer'>
            {field.label}
            {field.required && <span className='ml-1 text-destructive'>*</span>}
          </Label>
        </div>
      ) : (
        <>
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className='ml-1 text-destructive'>*</span>}
          </Label>

          {field.type === 'textarea' && (
            <Textarea
              id={field.id}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              rows={3}
            />
          )}

          {field.type === 'select' && (
            <Select
              value={(value as string) ?? ''}
              onValueChange={onChange}
              disabled={disabled}
            >
              <SelectTrigger id={field.id}>
                <SelectValue placeholder='Select an option' />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {field.type === 'file' && (
            <div className='flex items-center gap-2'>
              <input
                ref={fileInputRef}
                id={field.id}
                type='file'
                className='hidden'
                onChange={handleFileSelected}
                disabled={disabled || isUploading || !onUploadFile}
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={disabled || isUploading || !onUploadFile}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className='mr-2 h-3 w-3 animate-spin' />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Paperclip className='mr-2 h-3 w-3' />
                    {uploadedFile?.fileName ? 'Replace file' : 'Choose file'}
                  </>
                )}
              </Button>
              {uploadedFile?.fileName && (
                <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                  <span>{uploadedFile.fileName}</span>
                  {!disabled && (
                    <button
                      type='button'
                      onClick={() => onChange(undefined)}
                      className='text-muted-foreground hover:text-destructive'
                      aria-label='Remove file'
                    >
                      <X className='h-3 w-3' />
                    </button>
                  )}
                </div>
              )}
              {!onUploadFile && (
                <span className='text-xs text-muted-foreground'>
                  (preview only)
                </span>
              )}
            </div>
          )}

          {(field.type === 'text' ||
            field.type === 'number' ||
            field.type === 'date') && (
            <Input
              id={field.id}
              type={field.type}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
            />
          )}
        </>
      )}
    </div>
  )
}
