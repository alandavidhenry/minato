import type { ComprehensionQuestion } from '@/types/comprehension-question'
import type { FormField } from '@/types/form-schema'
import type { TemplateSnapshot } from '@/types/template-version-history'

export interface DiffItem<T> {
  status: 'added' | 'removed' | 'unchanged' | 'changed'
  id: string
  before: T | null
  after: T | null
}

export interface TemplateVersionDiff {
  title: { before: string; after: string; changed: boolean }
  description: { before: string | null; after: string | null; changed: boolean }
  formFields: DiffItem<FormField>[]
  questions: DiffItem<ComprehensionQuestion>[]
}

function diffById<T extends { id: string }>(
  before: T[] | null,
  after: T[] | null
): DiffItem<T>[] {
  const beforeList = before ?? []
  const afterList = after ?? []
  const afterMap = new Map(afterList.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const result: DiffItem<T>[] = []

  for (const beforeItem of beforeList) {
    seen.add(beforeItem.id)
    const afterItem = afterMap.get(beforeItem.id)
    if (!afterItem) {
      result.push({
        status: 'removed',
        id: beforeItem.id,
        before: beforeItem,
        after: null
      })
    } else {
      const unchanged = JSON.stringify(beforeItem) === JSON.stringify(afterItem)
      result.push({
        status: unchanged ? 'unchanged' : 'changed',
        id: beforeItem.id,
        before: beforeItem,
        after: afterItem
      })
    }
  }

  for (const afterItem of afterList) {
    if (!seen.has(afterItem.id)) {
      result.push({
        status: 'added',
        id: afterItem.id,
        before: null,
        after: afterItem
      })
    }
  }

  return result
}

export function diffTemplateSnapshots(
  before: TemplateSnapshot,
  after: TemplateSnapshot
): TemplateVersionDiff {
  return {
    title: {
      before: before.title,
      after: after.title,
      changed: before.title !== after.title
    },
    description: {
      before: before.description,
      after: after.description,
      changed: before.description !== after.description
    },
    formFields: diffById(before.formSchema, after.formSchema),
    questions: diffById(before.questions, after.questions)
  }
}
