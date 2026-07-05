import type { TemplateVersionDiff, DiffItem } from '@/lib/template-version-diff'
import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormField } from '@/types/form-schema'

interface VersionDiffViewProps {
  readonly diff: TemplateVersionDiff
}

function formFieldLabel(field: FormField): string {
  return `${field.label || '(no label)'} — ${field.type}${field.required ? ', required' : ''}`
}

function questionLabel(question: ComprehensionQuestion): string {
  return question.question || '(no question text)'
}

function DiffLine({
  text,
  status
}: {
  text: string
  status: 'added' | 'removed'
}) {
  return (
    <div
      className={
        status === 'added'
          ? 'rounded-md bg-green-50 px-2 py-1 text-green-900 dark:bg-green-950 dark:text-green-200'
          : 'rounded-md bg-red-50 px-2 py-1 text-red-900 line-through dark:bg-red-950 dark:text-red-200'
      }
    >
      {text}
    </div>
  )
}

function ItemDiffList<T>({
  items,
  labelFor
}: {
  items: DiffItem<T>[]
  labelFor: (item: T) => string
}) {
  if (items.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>None in either version.</p>
    )
  }

  return (
    <div className='space-y-1 text-sm'>
      {items.map((item) => {
        if (item.status === 'unchanged') {
          return (
            <div
              key={item.id}
              className='rounded-md bg-muted px-2 py-1 text-muted-foreground'
            >
              {labelFor(item.before ?? item.after!)}
            </div>
          )
        }
        if (item.status === 'added') {
          return (
            <DiffLine
              key={item.id}
              status='added'
              text={labelFor(item.after!)}
            />
          )
        }
        if (item.status === 'removed') {
          return (
            <DiffLine
              key={item.id}
              status='removed'
              text={labelFor(item.before!)}
            />
          )
        }
        // changed — show the superseded value followed by the new one
        return (
          <div key={item.id} className='space-y-1'>
            <DiffLine status='removed' text={labelFor(item.before!)} />
            <DiffLine status='added' text={labelFor(item.after!)} />
          </div>
        )
      })}
    </div>
  )
}

export function VersionDiffView({ diff }: VersionDiffViewProps) {
  return (
    <div className='space-y-4'>
      {diff.title.changed && (
        <div className='space-y-1 text-sm'>
          <span className='font-medium'>Title</span>
          <DiffLine status='removed' text={diff.title.before} />
          <DiffLine status='added' text={diff.title.after} />
        </div>
      )}

      {diff.description.changed && (
        <div className='space-y-1 text-sm'>
          <span className='font-medium'>Description</span>
          <DiffLine status='removed' text={diff.description.before ?? '—'} />
          <DiffLine status='added' text={diff.description.after ?? '—'} />
        </div>
      )}

      {!diff.title.changed && !diff.description.changed && (
        <p className='text-sm text-muted-foreground'>
          Title and description are unchanged.
        </p>
      )}

      <div className='space-y-1'>
        <span className='text-sm font-medium'>Form fields</span>
        <ItemDiffList items={diff.formFields} labelFor={formFieldLabel} />
      </div>

      <div className='space-y-1'>
        <span className='text-sm font-medium'>Comprehension questions</span>
        <ItemDiffList items={diff.questions} labelFor={questionLabel} />
      </div>
    </div>
  )
}
