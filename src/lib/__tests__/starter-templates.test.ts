import { describe, expect, it } from 'vitest'

import { STARTER_TEMPLATES } from '../starter-templates'

describe('STARTER_TEMPLATES', () => {
  it('has one preset for each documented H&S template type', () => {
    const names = STARTER_TEMPLATES.map((t) => t.name)
    expect(names).toEqual([
      'COSHH Assessment',
      'Manual Handling',
      'Risk Assessment',
      'Induction Checklist',
      'Toolbox Talk Record'
    ])
  })

  it('has a unique id per template', () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every template at least one field with a non-empty label', () => {
    for (const template of STARTER_TEMPLATES) {
      expect(template.fields.length).toBeGreaterThan(0)
      for (const field of template.fields) {
        expect(field.label.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('has unique field ids within each template', () => {
    for (const template of STARTER_TEMPLATES) {
      const ids = template.fields.map((f) => f.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('has unique field ids across all templates (so loading multiple never collides)', () => {
    const allIds = STARTER_TEMPLATES.flatMap((t) => t.fields.map((f) => f.id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('gives every select field a non-empty options list', () => {
    for (const template of STARTER_TEMPLATES) {
      for (const field of template.fields) {
        if (field.type === 'select') {
          expect(field.options?.length).toBeGreaterThan(0)
        }
      }
    }
  })
})
