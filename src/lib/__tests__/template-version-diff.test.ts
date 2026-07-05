import { describe, expect, it } from 'vitest'

import type { TemplateSnapshot } from '@/types/template-version-history'

import { diffTemplateSnapshots } from '../template-version-diff'

const BASE: TemplateSnapshot = {
  title: 'Farmyard Safety Checklist',
  description: 'Annual review',
  formSchema: [
    { id: 'f1', label: 'Fire exits clear?', type: 'checkbox', required: false }
  ],
  questions: [
    {
      id: 'q1',
      question: 'What should you do in a fire?',
      options: ['Evacuate', 'Hide'],
      answer: 'Evacuate'
    }
  ]
}

describe('diffTemplateSnapshots', () => {
  it('marks everything unchanged for identical snapshots', () => {
    const diff = diffTemplateSnapshots(BASE, BASE)

    expect(diff.title.changed).toBe(false)
    expect(diff.description.changed).toBe(false)
    expect(diff.formFields).toEqual([
      {
        status: 'unchanged',
        id: 'f1',
        before: BASE.formSchema![0],
        after: BASE.formSchema![0]
      }
    ])
    expect(diff.questions).toEqual([
      {
        status: 'unchanged',
        id: 'q1',
        before: BASE.questions![0],
        after: BASE.questions![0]
      }
    ])
  })

  it('detects title and description changes', () => {
    const after: TemplateSnapshot = {
      ...BASE,
      title: 'Farmyard Safety Checklist v2',
      description: null
    }

    const diff = diffTemplateSnapshots(BASE, after)

    expect(diff.title).toEqual({
      before: 'Farmyard Safety Checklist',
      after: 'Farmyard Safety Checklist v2',
      changed: true
    })
    expect(diff.description).toEqual({
      before: 'Annual review',
      after: null,
      changed: true
    })
  })

  it('detects an added form field', () => {
    const after: TemplateSnapshot = {
      ...BASE,
      formSchema: [
        ...BASE.formSchema!,
        { id: 'f2', label: 'PPE worn?', type: 'checkbox', required: false }
      ]
    }

    const diff = diffTemplateSnapshots(BASE, after)

    expect(diff.formFields).toEqual([
      {
        status: 'unchanged',
        id: 'f1',
        before: BASE.formSchema![0],
        after: BASE.formSchema![0]
      },
      { status: 'added', id: 'f2', before: null, after: after.formSchema![1] }
    ])
  })

  it('detects a removed form field', () => {
    const diff = diffTemplateSnapshots(BASE, { ...BASE, formSchema: [] })

    expect(diff.formFields).toEqual([
      { status: 'removed', id: 'f1', before: BASE.formSchema![0], after: null }
    ])
  })

  it('detects a changed form field', () => {
    const after: TemplateSnapshot = {
      ...BASE,
      formSchema: [
        {
          id: 'f1',
          label: 'Fire exits clear?',
          type: 'checkbox',
          required: true
        }
      ]
    }

    const diff = diffTemplateSnapshots(BASE, after)

    expect(diff.formFields).toEqual([
      {
        status: 'changed',
        id: 'f1',
        before: BASE.formSchema![0],
        after: after.formSchema![0]
      }
    ])
  })

  it('detects added, removed, and changed questions', () => {
    const after: TemplateSnapshot = {
      ...BASE,
      questions: [
        { ...BASE.questions![0], answer: 'Hide' },
        {
          id: 'q2',
          question: 'Who is the fire warden?',
          options: ['Simon', 'Alan'],
          answer: 'Simon'
        }
      ]
    }

    const diff = diffTemplateSnapshots(BASE, after)

    expect(diff.questions).toEqual([
      {
        status: 'changed',
        id: 'q1',
        before: BASE.questions![0],
        after: after.questions![0]
      },
      { status: 'added', id: 'q2', before: null, after: after.questions![1] }
    ])
  })

  it('handles null formSchema/questions on either side', () => {
    const diff = diffTemplateSnapshots(
      { ...BASE, formSchema: null, questions: null },
      BASE
    )

    expect(diff.formFields).toEqual([
      { status: 'added', id: 'f1', before: null, after: BASE.formSchema![0] }
    ])
    expect(diff.questions).toEqual([
      { status: 'added', id: 'q1', before: null, after: BASE.questions![0] }
    ])
  })
})
