// Pure retention-window logic for signed CompletionRecords. No prisma import
// here deliberately — this module is shared by server routes and the admin
// completions client page, so it must stay safe to bundle client-side.

export const DEFAULT_COMPLETION_RETENTION_YEARS = 5
export const MIN_COMPLETION_RETENTION_YEARS = 1
export const MAX_COMPLETION_RETENTION_YEARS = 50

export function getRetentionEndDate(
  signedAt: string | Date,
  retentionYears: number
): Date {
  const end = new Date(signedAt)
  end.setFullYear(end.getFullYear() + retentionYears)
  return end
}

export function isWithinRetentionPeriod(
  signedAt: string | Date,
  retentionYears: number,
  now: Date = new Date()
): boolean {
  return now < getRetentionEndDate(signedAt, retentionYears)
}
