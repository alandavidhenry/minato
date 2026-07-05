import { describe, expect, it } from 'vitest'

import type { FormField } from '@/types/form-schema'

import {
  getMissingRequiredFields,
  getVisibleFormData
} from '../form-validation'

function field(overrides: Partial<FormField>): FormField {
  return {
    id: overrides.id ?? 'f1',
    label: overrides.label ?? 'Field',
    type: overrides.type ?? 'text',
    required: overrides.required ?? true,
    ...overrides
  }
}

describe('getMissingRequiredFields', () => {
  it('returns empty when there are no fields', () => {
    expect(getMissingRequiredFields([], {})).toEqual([])
  })

  it('flags a required text field with no value', () => {
    const schema = [field({ id: 'name', label: 'Name', type: 'text' })]
    expect(getMissingRequiredFields(schema, {})).toEqual(['Name'])
    expect(getMissingRequiredFields(schema, { name: '' })).toEqual(['Name'])
    expect(getMissingRequiredFields(schema, { name: 'Alan' })).toEqual([])
  })

  it('flags an unchecked required checkbox', () => {
    const schema = [field({ id: 'agree', label: 'Agree', type: 'checkbox' })]
    expect(getMissingRequiredFields(schema, {})).toEqual(['Agree'])
    expect(getMissingRequiredFields(schema, { agree: false })).toEqual([
      'Agree'
    ])
    expect(getMissingRequiredFields(schema, { agree: true })).toEqual([])
  })

  it('flags a required number field with no value', () => {
    const schema = [field({ id: 'weight', label: 'Weight', type: 'number' })]
    expect(getMissingRequiredFields(schema, {})).toEqual(['Weight'])
    expect(getMissingRequiredFields(schema, { weight: '' })).toEqual(['Weight'])
    expect(getMissingRequiredFields(schema, { weight: '12' })).toEqual([])
  })

  it('flags a required select field with no chosen option', () => {
    const schema = [
      field({
        id: 'severity',
        label: 'Severity',
        type: 'select',
        options: ['Low', 'High']
      })
    ]
    expect(getMissingRequiredFields(schema, {})).toEqual(['Severity'])
    expect(getMissingRequiredFields(schema, { severity: 'Low' })).toEqual([])
  })

  it('flags a required file field with no uploaded blobPath', () => {
    const schema = [field({ id: 'photo', label: 'Photo', type: 'file' })]
    expect(getMissingRequiredFields(schema, {})).toEqual(['Photo'])
    expect(
      getMissingRequiredFields(schema, {
        photo: { blobPath: '', fileName: 'a' }
      })
    ).toEqual(['Photo'])
    expect(
      getMissingRequiredFields(schema, {
        photo: { blobPath: 'form-uploads/x.png', fileName: 'a.png' }
      })
    ).toEqual([])
  })

  it('never flags a section field even if marked required', () => {
    const schema = [
      field({
        id: 'heading',
        label: 'Heading',
        type: 'section',
        required: true
      })
    ]
    expect(getMissingRequiredFields(schema, {})).toEqual([])
  })

  it('skips fields hidden by an unmet condition', () => {
    const schema = [
      field({
        id: 'has_ppe',
        label: 'Has PPE?',
        type: 'checkbox',
        required: false
      }),
      field({
        id: 'ppe_type',
        label: 'PPE Type',
        type: 'text',
        condition: { fieldId: 'has_ppe', value: true }
      })
    ]
    expect(getMissingRequiredFields(schema, { has_ppe: false })).toEqual([])
    expect(getMissingRequiredFields(schema, { has_ppe: true })).toEqual([
      'PPE Type'
    ])
  })

  it('does not flag non-required fields', () => {
    const schema = [field({ id: 'notes', label: 'Notes', required: false })]
    expect(getMissingRequiredFields(schema, {})).toEqual([])
  })
})

describe('getVisibleFormData', () => {
  it('excludes section fields entirely', () => {
    const schema = [
      field({
        id: 'heading',
        label: 'Heading',
        type: 'section',
        required: false
      }),
      field({ id: 'name', label: 'Name', type: 'text', required: false })
    ]
    const result = getVisibleFormData(schema, { name: 'Alan' })
    expect(result).toEqual({ name: 'Alan' })
    expect(result).not.toHaveProperty('heading')
  })

  it('excludes fields hidden by condition', () => {
    const schema = [
      field({
        id: 'has_ppe',
        label: 'Has PPE?',
        type: 'checkbox',
        required: false
      }),
      field({
        id: 'ppe_type',
        label: 'PPE Type',
        type: 'text',
        required: false,
        condition: { fieldId: 'has_ppe', value: true }
      })
    ]
    const result = getVisibleFormData(schema, {
      has_ppe: false,
      ppe_type: 'Gloves'
    })
    expect(result).toEqual({ has_ppe: false })
  })

  it('includes visible non-section fields', () => {
    const schema = [field({ id: 'name', label: 'Name', required: false })]
    expect(getVisibleFormData(schema, { name: 'Alan' })).toEqual({
      name: 'Alan'
    })
  })
})
