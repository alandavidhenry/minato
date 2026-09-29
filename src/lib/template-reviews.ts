import { ADMIN_ROLES } from '@/types/rbac'

import prisma from './prisma'
import {
  computeReviewDueAt,
  getReviewStatus,
  isReviewReminderDue,
  REVIEW_DUE_SOON_DAYS,
  type ReviewStatus
} from './review-dates'
import {
  getAllUsers,
  getUserById,
  resolveEmailRecipients
} from './user-database'

import type { DocumentTemplateData } from './document-templates'

export interface TemplateReviewData {
  id: string
  templateId: string
  version: number
  reviewedAt: string
  reviewedBy: string | null
  note: string | null
}

export interface TemplateDueForReview {
  id: string
  title: string
  version: number
  reviewDueAt: string
  reviewOwnerId: string | null
  status: ReviewStatus
}

export interface ReviewReminderTarget {
  templateId: string
  templateTitle: string
  reviewDueAt: string
  isCompanyTemplate: boolean
  recipients: { email: string; name: string }[]
}

function toReviewData(r: {
  id: string
  templateId: string
  version: number
  reviewedAt: Date
  reviewedBy: string | null
  note: string | null
}): TemplateReviewData {
  return {
    id: r.id,
    templateId: r.templateId,
    version: r.version,
    reviewedAt: r.reviewedAt.toISOString(),
    reviewedBy: r.reviewedBy,
    note: r.note
  }
}

// "Reviewed - no changes": records an audit entry and restarts the review
// clock without bumping the version (so nothing is re-assigned or re-signed).
// Returns null when the template doesn't exist.
export async function markTemplateReviewed(
  templateId: string,
  { reviewedBy, note }: { reviewedBy?: string; note?: string }
): Promise<{
  template: Pick<
    DocumentTemplateData,
    'id' | 'version' | 'reviewDueAt' | 'lastReviewedAt'
  >
  review: TemplateReviewData
} | null> {
  try {
    const existing = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, version: true, reviewPeriodMonths: true }
    })
    if (!existing) return null

    const now = new Date()
    const [review, template] = await prisma.$transaction([
      prisma.templateReview.create({
        data: {
          templateId,
          version: existing.version,
          reviewedAt: now,
          reviewedBy,
          note: note || undefined
        }
      }),
      prisma.documentTemplate.update({
        where: { id: templateId },
        data: {
          reviewDueAt: computeReviewDueAt(now, existing.reviewPeriodMonths),
          lastReviewedAt: now,
          lastReviewReminderAt: null
        },
        select: {
          id: true,
          version: true,
          reviewDueAt: true,
          lastReviewedAt: true
        }
      })
    ])
    return {
      template: {
        id: template.id,
        version: template.version,
        reviewDueAt: template.reviewDueAt?.toISOString() ?? null,
        lastReviewedAt: template.lastReviewedAt?.toISOString() ?? null
      },
      review: toReviewData(review)
    }
  } catch (error) {
    console.error('Error marking template reviewed:', error)
    return null
  }
}

export async function getTemplateReviews(
  templateId: string
): Promise<TemplateReviewData[]> {
  try {
    const reviews = await prisma.templateReview.findMany({
      where: { templateId },
      orderBy: { reviewedAt: 'desc' }
    })
    return reviews.map(toReviewData)
  } catch (error) {
    console.error('Error getting template reviews:', error)
    return []
  }
}

// Templates that are overdue or due within the "soon" window, soonest first.
// Scoped to the tenant library by default (Simon's); pass a company id for that
// company's own self-serve templates.
export async function getTemplatesDueForReview(
  now: Date = new Date(),
  ownerCompanyId: string | null = null
): Promise<TemplateDueForReview[]> {
  const cutoff = new Date(now.getTime() + REVIEW_DUE_SOON_DAYS * 86_400_000)
  const templates = await prisma.documentTemplate.findMany({
    where: { ownerCompanyId, reviewDueAt: { lte: cutoff } },
    orderBy: { reviewDueAt: 'asc' },
    select: {
      id: true,
      title: true,
      version: true,
      reviewDueAt: true,
      reviewOwnerId: true
    }
  })
  return templates.flatMap((t) => {
    const status = getReviewStatus(t.reviewDueAt, now)
    if (!t.reviewDueAt || !status || status === 'ok') return []
    return [
      {
        id: t.id,
        title: t.title,
        version: t.version,
        reviewDueAt: t.reviewDueAt.toISOString(),
        reviewOwnerId: t.reviewOwnerId,
        status
      }
    ]
  })
}

// Templates whose owner should be emailed now (see isReviewReminderDue).
// Company-owned templates go to their owner only; tenant-library templates
// with no owner fall back to every admin so they never go unreminded.
export async function getTemplatesNeedingReviewReminders(
  today: Date
): Promise<ReviewReminderTarget[]> {
  const templates = await prisma.documentTemplate.findMany({
    where: { reviewDueAt: { not: null } },
    select: {
      id: true,
      title: true,
      reviewDueAt: true,
      reviewOwnerId: true,
      ownerCompanyId: true,
      lastReviewReminderAt: true
    }
  })

  let adminRecipients: ReviewReminderTarget['recipients'] | null = null

  const targets: ReviewReminderTarget[] = []
  for (const t of templates) {
    if (
      !t.reviewDueAt ||
      !isReviewReminderDue(t.reviewDueAt, t.lastReviewReminderAt, today)
    )
      continue

    let recipients: ReviewReminderTarget['recipients'] = []
    const owner = t.reviewOwnerId ? await getUserById(t.reviewOwnerId) : null
    if (owner) {
      recipients = await resolveEmailRecipients([owner])
    } else if (t.ownerCompanyId === null) {
      adminRecipients ??= await resolveEmailRecipients(
        (await getAllUsers()).filter((u) =>
          (ADMIN_ROLES as readonly string[]).includes(u.role)
        )
      )
      recipients = adminRecipients
    }
    if (recipients.length === 0) continue

    targets.push({
      templateId: t.id,
      templateTitle: t.title,
      reviewDueAt: t.reviewDueAt.toISOString(),
      isCompanyTemplate: t.ownerCompanyId !== null,
      recipients
    })
  }
  return targets
}
