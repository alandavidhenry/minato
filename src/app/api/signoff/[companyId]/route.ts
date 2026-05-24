// src/app/api/signoff/[companyId]/route.ts
// Public endpoint — no authentication required.
// Returns the company name and no-email workers with their pending assignments,
// used by the kiosk sign-off page.
import { NextRequest, NextResponse } from 'next/server'

import { getAssignmentsForUser } from '@/lib/assignments'
import { getCompletionsForUser } from '@/lib/completion-records'
import { getCustomerCompanyById } from '@/lib/customer-companies'
import { getNoEmailUsersByCompany } from '@/lib/user-database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params

    const company = await getCustomerCompanyById(companyId)
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const workers = await getNoEmailUsersByCompany(companyId)

    // For each worker, load their pending (uncompleted) assignments
    const workersWithAssignments = await Promise.all(
      workers.map(async (worker) => {
        const [assignments, completions] = await Promise.all([
          getAssignmentsForUser(worker.id, companyId, worker.jobRole),
          getCompletionsForUser(worker.id)
        ])
        const completedAssignmentIds = new Set(
          completions.map((c) => c.assignmentId)
        )
        const pendingAssignments = assignments.filter(
          (a) => !completedAssignmentIds.has(a.id)
        )
        return {
          id: worker.id,
          displayName: worker.displayName,
          jobRole: worker.jobRole,
          assignments: pendingAssignments.map((a) => ({
            id: a.id,
            templateId: a.templateId,
            dueDate: a.dueDate,
            template: {
              id: a.template.id,
              title: a.template.title,
              description: a.template.description,
              blobPath: a.template.blobPath,
              formSchema: a.template.formSchema,
              questions: a.template.questions
            }
          }))
        }
      })
    )

    return NextResponse.json({
      company: { id: company.id, name: company.name },
      workers: workersWithAssignments
    })
  } catch (error) {
    console.error('Error fetching kiosk data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch kiosk data' },
      { status: 500 }
    )
  }
}
