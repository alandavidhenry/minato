'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { STARTER_TEMPLATES } from '@/lib/starter-templates'
import type { FormField } from '@/types/form-schema'

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

interface StarterTemplatePickerProps {
  onSelect: (fields: FormField[]) => void
}

export function StarterTemplatePicker({
  onSelect
}: StarterTemplatePickerProps) {
  function handleSelect(templateId: string) {
    const template = STARTER_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    // Regenerate field ids so a starter template can never collide with
    // ids from another template loaded earlier in the same session.
    const idMap = new Map(template.fields.map((f) => [f.id, generateId()]))
    onSelect(
      template.fields.map((f) => ({
        ...f,
        id: idMap.get(f.id)!,
        condition: f.condition
          ? {
              ...f.condition,
              fieldId: idMap.get(f.condition.fieldId) ?? f.condition.fieldId
            }
          : undefined
      }))
    )
  }

  return (
    <div className='rounded-md border border-dashed p-3 grid gap-2'>
      <p className='text-sm text-muted-foreground'>
        Start from a common H&amp;S template, or build your own below.
      </p>
      <Select onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder='Start from template...' />
        </SelectTrigger>
        <SelectContent>
          {STARTER_TEMPLATES.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
