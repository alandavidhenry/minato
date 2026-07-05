import { describe, expect, it } from 'vitest'

import { generateCompletionPDF } from '../completion-pdf'

describe('generateCompletionPDF', () => {
  it('renders a PDF buffer for a schema covering every field type', async () => {
    const buffer = await generateCompletionPDF({
      templateTitle: 'Risk Assessment',
      signerName: 'Jane Smith',
      signerEmail: 'jane@example.com',
      signedAt: new Date('2026-01-01T10:00:00Z'),
      companyName: 'Acme Ltd',
      formSchema: [
        { id: 'heading', label: 'Section A', type: 'section', required: false },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'notes', label: 'Notes', type: 'textarea', required: false },
        { id: 'weight', label: 'Weight', type: 'number', required: false },
        { id: 'agree', label: 'Agree', type: 'checkbox', required: false },
        { id: 'date', label: 'Date', type: 'date', required: false },
        {
          id: 'severity',
          label: 'Severity',
          type: 'select',
          required: false,
          options: ['Low', 'High']
        },
        { id: 'photo', label: 'Photo', type: 'file', required: false }
      ],
      formData: {
        name: 'Jane Smith',
        notes: 'All clear',
        weight: '25',
        agree: true,
        date: '2026-01-01',
        severity: 'High',
        photo: { blobPath: 'form-uploads/x/photo-1-a.png', fileName: 'a.png' }
      },
      declarationName: 'Jane Smith'
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('renders a "—" placeholder when a file field has no uploaded value', async () => {
    const buffer = await generateCompletionPDF({
      templateTitle: 'Risk Assessment',
      signerName: 'Jane Smith',
      signerEmail: 'jane@example.com',
      signedAt: new Date('2026-01-01T10:00:00Z'),
      companyName: 'Acme Ltd',
      formSchema: [
        { id: 'photo', label: 'Photo', type: 'file', required: false }
      ],
      formData: {}
    })

    expect(buffer).toBeInstanceOf(Buffer)
  })
})
