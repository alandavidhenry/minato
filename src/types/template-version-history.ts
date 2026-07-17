import type { ComprehensionQuestion } from './comprehension-question'
import type {
  DocumentTemplateSourceType,
  DocumentTemplateUploadMode
} from './document-template'
import type { FormSchema } from './form-schema'

// The content of a DocumentTemplate at a given version.
// sourceType/uploadMode/sourceDoc* are optional because history entries
// written before P19 (upload-based documents) predate these fields.
export interface TemplateSnapshot {
  title: string
  description: string | null
  formSchema: FormSchema | null
  questions: ComprehensionQuestion[] | null
  sourceType?: DocumentTemplateSourceType
  uploadMode?: DocumentTemplateUploadMode | null
  sourceDocBlobPath?: string | null
  sourceDocOriginalBlobPath?: string | null
  sourceDocFileName?: string | null
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
