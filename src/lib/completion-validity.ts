// Pure date logic for recurring sign-offs — no prisma import, safe to use client-side.

export type ValidityStatus = 'valid' | 'expiring-soon' | 'expired'

// How far ahead of expiry the daily cron opens the next cycle, and the point at
// which a still-valid completion is flagged "Expiring soon". Tenant-configurable
// (Tenant.renewalLeadDays); this is the default.
export const DEFAULT_RENEWAL_LEAD_DAYS = 30
export const MIN_RENEWAL_LEAD_DAYS = 1
export const MAX_RENEWAL_LEAD_DAYS = 180

export function isValidRenewalLeadDays(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_RENEWAL_LEAD_DAYS &&
    value <= MAX_RENEWAL_LEAD_DAYS
  )
}

export const RECURRENCE_OPTIONS_MONTHS = [3, 6, 12, 24, 36] as const

export function isValidRecurrenceMonths(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 120
  )
}

// signedAt + months, clamping to month end (31 Jan + 1 month = 28/29 Feb)
export function computeValidUntil(signedAt: Date, months: number): Date {
  const result = new Date(signedAt.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate()
  result.setUTCDate(Math.min(day, daysInTargetMonth))
  return result
}

export function getValidityStatus(
  validUntil: Date | string | null | undefined,
  now: Date = new Date(),
  leadDays: number = DEFAULT_RENEWAL_LEAD_DAYS
): ValidityStatus | null {
  if (!validUntil) return null
  const end = new Date(validUntil).getTime()
  if (end <= now.getTime()) return 'expired'
  if (end - now.getTime() <= leadDays * 86_400_000) return 'expiring-soon'
  return 'valid'
}

export function formatRecurrence(months: number | null): string {
  if (!months) return 'Does not repeat'
  if (months % 12 === 0) {
    const years = months / 12
    return years === 1 ? 'Every year' : `Every ${years} years`
  }
  return `Every ${months} months`
}
