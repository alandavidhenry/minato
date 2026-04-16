'use client'

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import type { FormField, FormFieldType } from '@/types/form-schema'

function isCheckboxField(f: FormField) {
  return f.type === 'checkbox'
}

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
}

interface EditTemplateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly template: Template | null
  readonly onTemplateSaved: () => void
}

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  checkbox: 'Checkbox (yes/no)',
  date: 'Date'
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function EditTemplateDialog({
  open,
  onOpenChange,
  template,
  onTemplateSaved
}: EditTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormField[]>([])

  useEffect(() => {
    if (template) {
      setTitle(template.title)
      setDescription(template.description ?? '')
      setFields(template.formSchema ?? [])
    }
  }, [template])

  function addField() {
    setFields((prev) => [
      ...prev,
      { id: generateId(), label: '', type: 'text', required: false }
    ])
  }

  function availableConditionFields(fieldId: string): FormField[] {
    const idx = fields.findIndex((f) => f.id === fieldId)
    return fields.slice(0, idx).filter(isCheckboxField)
  }

  function moveField(id: string, direction: 'up' | 'down') {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      // Clear conditions that now reference a field that is no longer before them
      return next.map((f, i) => {
        if (!f.condition) return f
        const condIdx = next.findIndex((c) => c.id === f.condition!.fieldId)
        return condIdx < i ? f : { ...f, condition: undefined }
      })
    })
  }

  function removeField(id: string) {
    setFields((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f) =>
          f.condition?.fieldId === id ? { ...f, condition: undefined } : f
        )
    )
  }

  function updateField(id: string, changes: Partial<FormField>) {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === id) return { ...f, ...changes }
        // If this field's type is changing away from checkbox, clear any
        // conditions on other fields that reference it
        if (
          changes.type &&
          changes.type !== 'checkbox' &&
          f.condition?.fieldId === id
        ) {
          return { ...f, condition: undefined }
        }
        return f
      })
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template title is required',
        variant: 'destructive'
      })
      return
    }

    const emptyLabels = fields.filter((f) => !f.label.trim())
    if (emptyLabels.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'All form fields must have a label',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/templates/${template?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          formSchema: fields.length > 0 ? fields : null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save template')
      }

      onTemplateSaved()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[560px] max-h-[85vh] overflow-y-auto'>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the template details and define the form fields customers
              will fill in.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='edit-title'>Title</Label>
              <Input
                id='edit-title'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='edit-description'>
                Description{' '}
                <span className='text-muted-foreground'>(optional)</span>
              </Label>
              <Input
                id='edit-description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Brief description of the document'
                disabled={isLoading}
              />
            </div>

            <Separator />

            <div className='grid gap-3'>
              <div className='flex items-center justify-between'>
                <Label>Form Fields</Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={addField}
                  disabled={isLoading}
                >
                  <Plus className='mr-1 h-3 w-3' />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 && (
                <p className='text-sm text-muted-foreground'>
                  No form fields yet. Add fields for customers to fill in when
                  completing this document.
                </p>
              )}

              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className='rounded-md border p-3 grid gap-3'
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-muted-foreground'>
                      Field {index + 1}
                    </span>
                    <div className='flex items-center gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => moveField(field.id, 'up')}
                        disabled={isLoading || index === 0}
                      >
                        <ChevronUp className='h-3 w-3' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => moveField(field.id, 'down')}
                        disabled={isLoading || index === fields.length - 1}
                      >
                        <ChevronDown className='h-3 w-3' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => removeField(field.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor={`label-${field.id}`}>Label</Label>
                    <Input
                      id={`label-${field.id}`}
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                      placeholder='e.g. Are fire exits clear and unobstructed?'
                      disabled={isLoading}
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='grid gap-2'>
                      <Label htmlFor={`type-${field.id}`}>Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) => {
                          const newType = value as FormFieldType
                          updateField(field.id, {
                            type: newType,
                            ...(newType === 'checkbox' && { required: false })
                          })
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger id={`type-${field.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(FIELD_TYPE_LABELS) as [
                              FormFieldType,
                              string
                            ][]
                          ).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {field.type !== 'checkbox' && (
                      <div className='flex items-end gap-2 pb-1'>
                        <Checkbox
                          id={`required-${field.id}`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            updateField(field.id, {
                              required: checked === true
                            })
                          }
                          disabled={isLoading}
                        />
                        <Label
                          htmlFor={`required-${field.id}`}
                          className='cursor-pointer'
                        >
                          Required
                        </Label>
                      </div>
                    )}
                  </div>

                  {availableConditionFields(field.id).length > 0 && (
                    <div className='grid gap-2'>
                      <Label>Show only when</Label>
                      <div className='flex gap-2'>
                        <Select
                          value={field.condition?.fieldId ?? 'none'}
                          onValueChange={(value) => {
                            if (value === 'none') {
                              updateField(field.id, { condition: undefined })
                            } else {
                              updateField(field.id, {
                                condition: {
                                  fieldId: value,
                                  value: field.condition?.value ?? true
                                }
                              })
                            }
                          }}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='none'>Always show</SelectItem>
                            {availableConditionFields(field.id).map((cf) => (
                              <SelectItem key={cf.id} value={cf.id}>
                                {cf.label ||
                                  `Checkbox ${fields.indexOf(cf) + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.condition && (
                          <Select
                            value={field.condition.value ? 'true' : 'false'}
                            onValueChange={(value) =>
                              updateField(field.id, {
                                condition: {
                                  fieldId: field.condition!.fieldId,
                                  value: value === 'true'
                                }
                              })
                            }
                            disabled={isLoading}
                          >
                            <SelectTrigger className='w-28'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='true'>is Yes</SelectItem>
                              <SelectItem value='false'>is No</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
