'use client'

import { useEffect, useState } from 'react'

import type { ComplianceKPIs } from '@/lib/compliance-kpis'

import { CompanyCompletionRateChart } from './charts/CompanyCompletionRateChart'
import { MonthlyThroughputChart } from './charts/MonthlyThroughputChart'
import { TemplateAvgDaysChart } from './charts/TemplateAvgDaysChart'
import { RiskIndicatorsTable } from './RiskIndicatorsTable'

export function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceKPIs | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/admin/dashboard/compliance-kpis')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json() as Promise<ComplianceKPIs>
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className='text-sm text-muted-foreground py-4'>
        Could not load compliance metrics.
      </p>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <CompanyCompletionRateChart data={data.companyCompletionRates} />
        <TemplateAvgDaysChart data={data.templateAvgDays} />
      </div>
      <MonthlyThroughputChart data={data.monthlyThroughput} />
      <RiskIndicatorsTable
        companiesWithNoRecentCompletions={data.companiesWithNoRecentCompletions}
        coverageGaps={data.coverageGaps}
        topOverdueUsers={data.topOverdueUsers}
      />
    </div>
  )
}
