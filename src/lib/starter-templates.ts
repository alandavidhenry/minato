// src/lib/starter-templates.ts
// Hardcoded, client-side-only presets for common H&S document types.
// Loaded into the form builder canvas as a starting point — never touches
// the server; formSchema is saved through the normal template save flow.
import type { FormField } from '@/types/form-schema'

export interface StarterTemplate {
  id: string
  name: string
  fields: FormField[]
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'coshh-assessment',
    name: 'COSHH Assessment',
    fields: [
      {
        id: 'coshh-substance-name',
        label: 'Substance name',
        type: 'text',
        required: true
      },
      { id: 'coshh-supplier', label: 'Supplier', type: 'text', required: true },
      {
        id: 'coshh-hazard-classification',
        label: 'Hazard classification',
        type: 'select',
        required: true,
        options: [
          'Irritant',
          'Corrosive',
          'Toxic',
          'Flammable',
          'Environmental hazard'
        ]
      },
      {
        id: 'coshh-exposure-route',
        label: 'Exposure route',
        type: 'select',
        required: true,
        options: ['Inhalation', 'Skin contact', 'Ingestion', 'Eye contact']
      },
      {
        id: 'coshh-ppe-required',
        label: 'PPE required',
        type: 'textarea',
        required: true
      },
      {
        id: 'coshh-emergency-procedure',
        label: 'Emergency procedure',
        type: 'textarea',
        required: true
      },
      {
        id: 'coshh-assessor-name',
        label: 'Assessor name',
        type: 'text',
        required: true
      }
    ]
  },
  {
    id: 'manual-handling',
    name: 'Manual Handling',
    fields: [
      {
        id: 'mh-task-description',
        label: 'Task description',
        type: 'textarea',
        required: true
      },
      {
        id: 'mh-load-weight',
        label: 'Load weight (kg)',
        type: 'number',
        required: true
      },
      {
        id: 'mh-frequency',
        label: 'Frequency',
        type: 'select',
        required: true,
        options: ['Rarely', 'Occasionally', 'Frequently', 'Constantly']
      },
      {
        id: 'mh-posture-assessment',
        label: 'Posture assessment',
        type: 'textarea',
        required: true
      },
      {
        id: 'mh-controls-in-place',
        label: 'Controls in place',
        type: 'textarea',
        required: true
      },
      {
        id: 'mh-residual-risk-rating',
        label: 'Residual risk rating',
        type: 'select',
        required: true,
        options: ['Low', 'Medium', 'High']
      }
    ]
  },
  {
    id: 'risk-assessment',
    name: 'Risk Assessment',
    fields: [
      {
        id: 'ra-hazard-description',
        label: 'Hazard description',
        type: 'textarea',
        required: true
      },
      {
        id: 'ra-who-at-risk',
        label: 'Who is at risk',
        type: 'text',
        required: true
      },
      {
        id: 'ra-likelihood',
        label: 'Likelihood (1-5)',
        type: 'select',
        required: true,
        options: ['1', '2', '3', '4', '5']
      },
      {
        id: 'ra-severity',
        label: 'Severity (1-5)',
        type: 'select',
        required: true,
        options: ['1', '2', '3', '4', '5']
      },
      {
        id: 'ra-existing-controls',
        label: 'Existing controls',
        type: 'textarea',
        required: true
      },
      {
        id: 'ra-further-actions',
        label: 'Further actions',
        type: 'textarea',
        required: false
      }
    ]
  },
  {
    id: 'induction-checklist',
    name: 'Induction Checklist',
    fields: [
      {
        id: 'ic-site-rules-acknowledged',
        label: 'Site rules acknowledged',
        type: 'checkbox',
        required: true
      },
      {
        id: 'ic-ppe-issued',
        label: 'PPE issued',
        type: 'checkbox',
        required: true
      },
      {
        id: 'ic-emergency-exits-shown',
        label: 'Emergency exits shown',
        type: 'checkbox',
        required: true
      },
      {
        id: 'ic-fire-assembly-point-confirmed',
        label: 'Fire assembly point confirmed',
        type: 'checkbox',
        required: true
      },
      {
        id: 'ic-first-aider-contact-known',
        label: 'First aider contact known',
        type: 'checkbox',
        required: true
      }
    ]
  },
  {
    id: 'toolbox-talk-record',
    name: 'Toolbox Talk Record',
    fields: [
      { id: 'tt-topic', label: 'Topic', type: 'text', required: true },
      { id: 'tt-presenter', label: 'Presenter', type: 'text', required: true },
      { id: 'tt-date', label: 'Date', type: 'date', required: true },
      {
        id: 'tt-site-location',
        label: 'Site/location',
        type: 'text',
        required: true
      },
      {
        id: 'tt-attendee-names',
        label: 'Attendee names (one per line)',
        type: 'textarea',
        required: true
      }
    ]
  }
]
