'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableFieldCardProps {
  id: string
  children: React.ReactNode
}

export function SortableFieldCard({ id, children }: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style} className='relative'>
      <button
        type='button'
        {...attributes}
        {...listeners}
        className='absolute left-1 top-3 touch-none cursor-grab text-muted-foreground hover:text-foreground'
        aria-label='Drag to reorder'
      >
        <GripVertical className='h-4 w-4' />
      </button>
      <div className='pl-6'>{children}</div>
    </div>
  )
}
