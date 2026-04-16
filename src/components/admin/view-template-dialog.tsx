// src/components/admin/view-template-dialog.tsx
'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FormField } from '@/types/form-schema'

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
}

interface ViewTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Template | null
}

function isFieldVisible(
  field: FormField,
  values: Record<string, unknown>
): boolean {
  if (!field.condition) return true
  return (values[field.condition.fieldId] === true) === field.condition.value
}

export function ViewTemplateDialog({
  open,
  onOpenChange,
  template
}: ViewTemplateDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setValues({})
    onOpenChange(nextOpen)
  }

  if (!template) return null

  const fields: FormField[] = template.formSchema ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{template.title}</DialogTitle>
          {template.description && (
            <p className='text-sm text-muted-foreground'>
              {template.description}
            </p>
          )}
        </DialogHeader>

        <div className='space-y-5 pt-2'>
          {fields.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              This template has no form fields.
            </p>
          ) : (
            fields
              .filter((f) => isFieldVisible(f, values))
              .map((field) => (
                <div key={field.id} className='grid gap-2'>
                  {field.type === 'checkbox' ? (
                    <div className='flex items-start gap-3'>
                      <Checkbox
                        id={`preview-${field.id}`}
                        checked={values[field.id] === true}
                        onCheckedChange={(checked) =>
                          setValue(field.id, checked === true)
                        }
                        className='mt-0.5'
                      />
                      <Label
                        htmlFor={`preview-${field.id}`}
                        className='cursor-pointer'
                      >
                        {field.label}
                        {field.required && (
                          <span className='ml-1 text-destructive'>*</span>
                        )}
                      </Label>
                    </div>
                  ) : (
                    <>
                      <Label htmlFor={`preview-${field.id}`}>
                        {field.label}
                        {field.required && (
                          <span className='ml-1 text-destructive'>*</span>
                        )}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={`preview-${field.id}`}
                          value={(values[field.id] as string) ?? ''}
                          onChange={(e) => setValue(field.id, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={`preview-${field.id}`}
                          type={field.type === 'date' ? 'date' : 'text'}
                          value={(values[field.id] as string) ?? ''}
                          onChange={(e) => setValue(field.id, e.target.value)}
                        />
                      )}
                    </>
                  )}
                </div>
              ))
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
