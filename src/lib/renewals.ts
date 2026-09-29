import { DEFAULT_RENEWAL_LEAD_DAYS } from './completion-validity'
import prisma from './prisma'
import {
  getRenewalLeadDaysForCompany,
  getUserById,
  resolveEmailRecipients
} from './user-database'

export interface RenewalTarget {
  assignmentId: string
  templateTitle: string
  dueDate: string
  recipients: { email: string; name: string }[]
}

// Opens the next cycle for every recurring completion that expires within
// the tenant's renewal lead time (Tenant.renewalLeadDays). The renewal is an individual Assignment for the signer at
// cycle + 1 (same template version), due on the day the old completion lapses —
// from there the normal reminder schedule applies.
//
// Skipped when the user has since re-signed (a completion with a later or
// non-expiring validUntil), or a newer version/cycle already supersedes the
// expiring one, so re-running the job is idempotent.
export async function renewExpiringCompletions(
  now: Date
): Promise<RenewalTarget[]> {
  // Query out to the longest lead time any tenant uses, then apply each
  // company's own lead time per record below
  const maxLead = await prisma.tenant.aggregate({
    _max: { renewalLeadDays: true }
  })
  const horizon = new Date(
    now.getTime() +
      (maxLead._max.renewalLeadDays ?? DEFAULT_RENEWAL_LEAD_DAYS) * 86_400_000
  )
  const leadByCompany = new Map<string, number>()

  const expiring = await prisma.completionRecord.findMany({
    where: { validUntil: { not: null, lte: horizon } },
    include: {
      assignment: {
        select: {
          id: true,
          templateId: true,
          customerCompanyId: true,
          templateVersion: true,
          cycle: true,
          recurrenceMonths: true,
          template: { select: { title: true } }
        }
      }
    },
    orderBy: { validUntil: 'desc' }
  })

  const results: RenewalTarget[] = []
  const handled = new Set<string>()

  for (const record of expiring) {
    const { assignment } = record
    const validUntil = record.validUntil as Date
    const key = `${record.signedById}:${assignment.templateId}`
    if (handled.has(key)) continue
    // The latest completion per user+template decides; older ones are moot
    handled.add(key)

    let leadDays = leadByCompany.get(assignment.customerCompanyId)
    if (leadDays === undefined) {
      leadDays = await getRenewalLeadDaysForCompany(
        assignment.customerCompanyId
      )
      leadByCompany.set(assignment.customerCompanyId, leadDays)
    }
    if (validUntil.getTime() - now.getTime() > leadDays * 86_400_000) continue

    const user = await prisma.user.findUnique({
      where: { id: record.signedById },
      select: { id: true, customerCompanyId: true, jobRole: true }
    })
    if (!user || user.customerCompanyId !== assignment.customerCompanyId) {
      continue
    }

    // Has the user already re-signed this template with a later/none expiry?
    const resigned = await prisma.completionRecord.findFirst({
      where: {
        signedById: record.signedById,
        assignment: { templateId: assignment.templateId },
        OR: [{ validUntil: null }, { validUntil: { gt: validUntil } }]
      },
      select: { id: true }
    })
    if (resigned) continue

    // Is there already a newer cycle/version for this user (open or done)?
    const superseding = await prisma.assignment.findFirst({
      where: {
        templateId: assignment.templateId,
        OR: [
          {
            userId: record.signedById,
            OR: [
              { templateVersion: { gt: assignment.templateVersion } },
              {
                templateVersion: assignment.templateVersion,
                cycle: { gt: assignment.cycle }
              }
            ]
          },
          {
            userId: null,
            customerCompanyId: assignment.customerCompanyId,
            templateVersion: { gt: assignment.templateVersion }
          }
        ]
      },
      select: { id: true, userId: true, targetJobRoles: true }
    })
    if (superseding) {
      const roles = Array.isArray(superseding.targetJobRoles)
        ? (superseding.targetJobRoles as string[])
        : null
      const appliesToUser =
        superseding.userId !== null ||
        !roles ||
        roles.length === 0 ||
        !user.jobRole ||
        roles.includes(user.jobRole)
      if (appliesToUser) continue
    }

    const renewal = await prisma.assignment.create({
      data: {
        templateId: assignment.templateId,
        customerCompanyId: assignment.customerCompanyId,
        userId: record.signedById,
        dueDate: validUntil,
        templateVersion: assignment.templateVersion,
        cycle: assignment.cycle + 1,
        recurrenceMonths: assignment.recurrenceMonths,
        autoEnroll: false
      }
    })

    const userData = await getUserById(record.signedById)
    const recipients = userData ? await resolveEmailRecipients([userData]) : []

    results.push({
      assignmentId: renewal.id,
      templateTitle: assignment.template.title,
      dueDate: validUntil.toISOString(),
      recipients
    })
  }

  return results
}
