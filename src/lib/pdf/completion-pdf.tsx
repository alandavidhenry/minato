// src/lib/pdf/completion-pdf.tsx
// Server-side only — used in API routes via renderToBuffer.
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'

import type { FormField, FormSchema } from '@/types/form-schema'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 48,
    color: '#111827'
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 12
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280'
  },
  metaSection: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 4
  },
  metaItem: {
    flex: 1
  },
  metaLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 2
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold'
  },
  fieldsSection: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    color: '#374151'
  },
  fieldRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  fieldLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 3
  },
  fieldValue: {
    fontSize: 10
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center'
  }
})

export interface CompletionPDFProps {
  templateTitle: string
  signerName: string
  signerEmail: string
  signedAt: Date
  companyName: string
  formSchema: FormSchema
  formData: Record<string, unknown>
}

function formatFieldValue(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (field.type === 'checkbox') return value === true ? 'Yes ✓' : 'No ✗'
  if (field.type === 'date' && typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB')
  }
  return String(value)
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

export function CompletionDocument({
  templateTitle,
  signerName,
  signerEmail,
  signedAt,
  companyName,
  formSchema,
  formData
}: CompletionPDFProps) {
  return (
    <Document title={`${templateTitle} — Completion Record`}>
      <Page size='A4' style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{templateTitle}</Text>
          <Text style={styles.subtitle}>Completion Record</Text>
        </View>

        {/* Metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Completed by</Text>
            <Text style={styles.metaValue}>{signerName}</Text>
            <Text style={{ ...styles.metaLabel, marginTop: 1 }}>
              {signerEmail}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Company</Text>
            <Text style={styles.metaValue}>{companyName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Completed at</Text>
            <Text style={styles.metaValue}>{formatDate(signedAt)}</Text>
          </View>
        </View>

        {/* Form fields */}
        {formSchema.length > 0 && (
          <View style={styles.fieldsSection}>
            <Text style={styles.sectionTitle}>Responses</Text>
            {formSchema.map((field) => (
              <View key={field.id} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldValue}>
                  {formatFieldValue(field, formData[field.id])}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          This record was generated electronically. Record ID:{' '}
          {Math.random().toString(36).slice(2).toUpperCase()} — Do not alter
          this document.
        </Text>
      </Page>
    </Document>
  )
}

export async function generateCompletionPDF(
  props: CompletionPDFProps
): Promise<Buffer> {
  return renderToBuffer(<CompletionDocument {...props} />)
}
