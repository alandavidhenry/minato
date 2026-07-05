import type { ComprehensionQuestion } from './comprehension-question'
import type { FormSchema } from './form-schema'

// The content of a DocumentTemplate at a given version.
export interface TemplateSnapshot {
  title: string
  description: string | null
  formSchema: FormSchema | null
  questions: ComprehensionQuestion[] | null
}

export interface TemplateVersionHistoryEntry {
  id: string
  templateId: string
  version: number
  changeReason: string | null
  snapshot: TemplateSnapshot
  publishedAt: string
  publishedBy: string | null
  publishedByName: string | null
  isCurrent: boolean
}
