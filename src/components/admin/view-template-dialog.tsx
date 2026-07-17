// src/components/admin/view-template-dialog.tsx
'use client'

import { useState } from 'react'

import { TemplateVersionHistory } from '@/components/admin/template-version-history'
import { FormFieldRenderer } from '@/components/form-field-renderer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isFieldVisible } from '@/lib/form-schema-utils'
import type { DocumentTemplateSourceType } from '@/types/document-template'
import type { FormField } from '@/types/form-schema'

interface Template {
  id: string
  title: string
  description: string | null
  formSchema: FormField[] | null
  version: number
  sourceType?: DocumentTemplateSourceType
  sourceDocFileName?: string | null
}

interface ViewTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Template | null
}

export function ViewTemplateDialog({
  open,
  onOpenChange,
  template
}: ViewTemplateDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [activeTab, setActiveTab] = useState('preview')

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValues({})
      setActiveTab('preview')
    }
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className='pt-2'>
          <TabsList>
            <TabsTrigger value='preview'>Preview</TabsTrigger>
            <TabsTrigger value='history'>Version History</TabsTrigger>
          </TabsList>

          <TabsContent value='preview' className='space-y-5 pt-2'>
            {template.sourceType === 'upload' ? (
              <p className='text-sm text-muted-foreground'>
                Uploaded document: {template.sourceDocFileName ?? 'untitled'}. A
                preview/download link will be available here once the
                employee-facing viewer is built.
              </p>
            ) : fields.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                This template has no form fields.
              </p>
            ) : (
              fields
                .filter((f) => isFieldVisible(f, values))
                .map((field) => (
                  <FormFieldRenderer
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(value) => setValue(field.id, value)}
                  />
                ))
            )}
          </TabsContent>

          <TabsContent value='history' className='pt-2'>
            <TemplateVersionHistory
              templateId={template.id}
              active={activeTab === 'history'}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
