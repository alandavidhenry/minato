'use client'

import { useDraggable } from '@dnd-kit/core'

import { Button } from '@/components/ui/button'
import type { FormFieldType } from '@/types/form-schema'

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  checkbox: 'Yes/No',
  select: 'Dropdown',
  file: 'File upload',
  section: 'Section heading'
}

const PALETTE_TYPES = Object.keys(FIELD_TYPE_LABELS) as FormFieldType[]

interface PaletteItemProps {
  type: FormFieldType
  onAppend: (type: FormFieldType) => void
  disabled?: boolean
}

function PaletteItem({ type, onAppend, disabled }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { paletteType: type },
    disabled
  })

  return (
    <Button
      ref={setNodeRef}
      type='button'
      variant='outline'
      size='sm'
      className={`justify-start touch-none ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onAppend(type)}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      {FIELD_TYPE_LABELS[type]}
    </Button>
  )
}

interface FieldTypePaletteProps {
  onAppend: (type: FormFieldType) => void
  disabled?: boolean
}

export function FieldTypePalette({
  onAppend,
  disabled
}: FieldTypePaletteProps) {
  return (
    <div className='grid gap-2'>
      <p className='text-xs text-muted-foreground'>
        Click to add a field, or drag it onto the canvas.
      </p>
      <div className='grid grid-cols-2 gap-2'>
        {PALETTE_TYPES.map((type) => (
          <PaletteItem
            key={type}
            type={type}
            onAppend={onAppend}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}
