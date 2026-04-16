// src/types/form-schema.ts

export type FormFieldType = 'text' | 'textarea' | 'checkbox' | 'date'

export interface FieldCondition {
  /** ID of a checkbox field earlier in the schema */
  fieldId: string
  /** true = show when that checkbox is checked (Yes); false = show when unchecked (No) */
  value: boolean
}

export interface FormField {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  condition?: FieldCondition
}

export type FormSchema = FormField[]
