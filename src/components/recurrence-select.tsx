'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { RECURRENCE_OPTIONS_MONTHS } from '@/lib/completion-validity'

const NONE = 'none'

function optionLabel(months: number): string {
  if (months % 12 === 0) {
    return months === 12 ? 'Every year' : `Every ${months / 12} years`
  }
  return `Every ${months} months`
}

interface RecurrenceSelectProps {
  id: string
  value: number | null
  onChange: (months: number | null) => void
  disabled?: boolean
}

export function RecurrenceSelect({
  id,
  value,
  onChange,
  disabled
}: RecurrenceSelectProps) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>Repeat sign-off (optional)</Label>
      <Select
        value={value === null ? NONE : String(value)}
        onValueChange={(v) => onChange(v === NONE ? null : Number(v))}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Does not repeat</SelectItem>
          {RECURRENCE_OPTIONS_MONTHS.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {optionLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className='text-xs text-muted-foreground'>
        Each signature expires after this period, and employees are asked to
        re-sign 30 days before it does.
      </p>
    </div>
  )
}
