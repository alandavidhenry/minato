// src/lib/form-schema-utils.ts
// Pure helpers shared between client-side form rendering and server-side
// validation — no Node-only imports so this can be used in both.
import type { FormField } from '@/types/form-schema'

export function isFieldVisible(
  field: FormField,
  formData: Record<string, unknown>
): boolean {
  if (!field.condition) return true
  return (formData[field.condition.fieldId] === true) === field.condition.value
}
