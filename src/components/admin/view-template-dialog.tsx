// src/components/admin/view-template-dialog.tsx
'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

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
import { toast } from '@/components/ui/use-toast'
import { isFieldVisible } from '@/lib/form-schema-utils'
import type { DocumentTemplateSourceType } from '@/types/document-template'
import type { FormField } from '@/types/form-schema'

const PDFRenderer = dynamic(
  () =>
    import('@/app/documents/view/[...name]/components/PDFRenderer').then(
      (m) => m.PDFRenderer
    ),
  { ssr: false }
)

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
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  function setValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValues({})
      setActiveTab('preview')
      setPdfData(null)
    }
    onOpenChange(nextOpen)
  }

  const loadDocument = useCallback(async (templateId: string) => {
    setIsPdfLoading(true)
    try {
      const dlRes = await fetch(`/api/admin/templates/${templateId}/document`)
      if (!dlRes.ok) {
        const err = await dlRes.json()
        throw new Error(err.error ?? 'Failed to get document link')
      }
      const { url } = await dlRes.json()

      const proxyRes = await fetch(
        `/api/documents/proxy?url=${encodeURIComponent(url)}`
      )
      if (!proxyRes.ok) throw new Error('Failed to load document')

      const buffer = await proxyRes.arrayBuffer()
      setPdfData(new Uint8Array(buffer))
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to load document',
        variant: 'destructive'
      })
    } finally {
      setIsPdfLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && template?.sourceType === 'upload' && !pdfData) {
      loadDocument(template.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id, template?.sourceType])

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
              <PDFRenderer
                pdfData={pdfData}
                isLoading={isPdfLoading}
                fileName={template.sourceDocFileName ?? 'document.pdf'}
              />
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
