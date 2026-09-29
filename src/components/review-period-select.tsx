'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  isValidReviewPeriod,
  MAX_REVIEW_MONTHS,
  MIN_REVIEW_MONTHS,
  REVIEW_PERIOD_OPTIONS_MONTHS
} from '@/lib/review-dates'

const DEFAULT = 'default'
const CUSTOM = 'custom'

function optionLabel(months: number): string {
  if (months % 12 === 0) {
    return months === 12 ? 'Every year' : `Every ${months / 12} years`
  }
  return `Every ${months} months`
}

interface ReviewPeriodSelectProps {
  id: string
  // null = use the default
  value: number | null
  onChange: (months: number | null) => void
  disabled?: boolean
  label?: string
  defaultLabel?: string
  description?: string
}

export function ReviewPeriodSelect({
  id,
  value,
  onChange,
  disabled,
  label = 'Review period',
  defaultLabel = 'Use default',
  description = 'How often this document is reviewed. It can be changed later in Review settings.'
}: ReviewPeriodSelectProps) {
  const isPreset = (m: number | null) =>
    m !== null &&
    (REVIEW_PERIOD_OPTIONS_MONTHS as readonly number[]).includes(m)
  const [customMode, setCustomMode] = useState(
    value !== null && !isPreset(value)
  )
  const [customText, setCustomText] = useState(
    value !== null && !isPreset(value) ? String(value) : ''
  )

  const selectValue = customMode
    ? CUSTOM
    : value === null
      ? DEFAULT
      : String(value)
  const customInvalid = customMode && !isValidReviewPeriod(Number(customText))

  function handleSelect(v: string) {
    if (v === CUSTOM) {
      setCustomMode(true)
      // Start from the current value so the input is never blank-but-valid
      const start = value ?? 12
      setCustomText(String(start))
      onChange(start)
      return
    }
    setCustomMode(false)
    onChange(v === DEFAULT ? null : Number(v))
  }

  function handleCustomChange(text: string) {
    setCustomText(text)
    const months = Number(text)
    // Only emit valid values; an invalid entry keeps the last valid one and
    // shows an error, so it can never silently fall back to the default
    if (isValidReviewPeriod(months)) onChange(months)
  }

  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={selectValue}
        onValueChange={handleSelect}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
          {REVIEW_PERIOD_OPTIONS_MONTHS.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {optionLabel(m)}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <div className='flex items-center gap-2'>
          <Input
            id={`${id}-custom`}
            type='number'
            min={MIN_REVIEW_MONTHS}
            max={MAX_REVIEW_MONTHS}
            className='w-24'
            value={customText}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={disabled}
            aria-label='Custom review period in months'
            aria-invalid={customInvalid}
          />
          <span className='text-sm text-muted-foreground'>months</span>
          {customInvalid && (
            <span className='text-xs text-destructive'>
              Enter {MIN_REVIEW_MONTHS}–{MAX_REVIEW_MONTHS}
            </span>
          )}
        </div>
      )}
      <p className='text-xs text-muted-foreground'>{description}</p>
    </div>
  )
}
