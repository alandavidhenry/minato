// src/lib/form-validation.ts
// Server-side validation of submitted formData against a template's
// formSchema — shared by the authenticated and kiosk completion routes.
import { isFieldVisible } from '@/lib/form-schema-utils'
import type { FormField, FormSchema } from '@/types/form-schema'

function isFieldValueMissing(field: FormField, value: unknown): boolean {
  if (field.type === 'checkbox') return value !== true
  if (field.type === 'file') {
    const blobPath = (value as { blobPath?: string } | null | undefined)
      ?.blobPath
    return !blobPath
  }
  return value === undefined || value === null || value === ''
}

export function getMissingRequiredFields(
  schema: FormSchema,
  formData: Record<string, unknown>
): string[] {
  return schema
    .filter(
      (field) =>
        field.type !== 'section' &&
        field.required &&
        isFieldVisible(field, formData)
    )
    .filter((field) => isFieldValueMissing(field, formData[field.id]))
    .map((field) => field.label)
}

export function getVisibleFormData(
  schema: FormSchema,
  formData: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    schema
      .filter(
        (field) => field.type !== 'section' && isFieldVisible(field, formData)
      )
      .map((field) => [field.id, formData[field.id]])
  )
}
