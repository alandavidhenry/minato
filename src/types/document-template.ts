export type DocumentTemplateSourceType = 'form' | 'upload'

export type DocumentTemplateUploadMode = 'read-only' | 'fill-and-return'

export type DocumentTemplateCategory =
  | 'COSHH'
  | 'Fire Safety'
  | 'First Aid'
  | 'General'
  | 'Manual Handling'
  | 'Other'
  | 'PPE'
  | 'Risk Assessment'

export const DOCUMENT_TEMPLATE_CATEGORIES: DocumentTemplateCategory[] = [
  'COSHH',
  'Fire Safety',
  'First Aid',
  'General',
  'Manual Handling',
  'Other',
  'PPE',
  'Risk Assessment'
]
