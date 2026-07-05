// src/types/form-schema.ts

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'select'
  | 'file'
  | 'section'

export interface FieldCondition {
  /** ID of a checkbox field earlier in the schema */
  fieldId: string
  /** true = show when that checkbox is checked (Yes); false = show when unchecked (No) */
  value: boolean
}

/** Value stored in formData for a 'file' field once uploaded */
export interface UploadedFileValue {
  blobPath: string
  fileName: string
}

export interface FormField {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  condition?: FieldCondition
  /** Dropdown options — 'select' fields only */
  options?: string[]
}

export type FormSchema = FormField[]
