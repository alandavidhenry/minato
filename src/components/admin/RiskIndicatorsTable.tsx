import { AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RiskIndicatorsTableProps {
  readonly companiesWithNoRecentCompletions: { id: string; name: string }[]
  readonly coverageGaps: { companyName: string; templateTitle: string }[]
  readonly topOverdueUsers: { displayName: string; overdueCount: number }[]
}

export function RiskIndicatorsTable({
  companiesWithNoRecentCompletions,
  coverageGaps,
  topOverdueUsers
}: RiskIndicatorsTableProps) {
  const allClear =
    companiesWithNoRecentCompletions.length === 0 &&
    coverageGaps.length === 0 &&
    topOverdueUsers.length === 0

  return (
    <Card className='col-span-full'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5 text-destructive' />
          Risk Indicators
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allClear ? (
          <p className='text-sm text-muted-foreground'>
            No risk indicators — all companies are active and up to date.
          </p>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {/* Companies with no completions in last 30 days */}
            <div>
              <h3 className='text-sm font-semibold mb-2'>
                No completions in last 30 days
              </h3>
              {companiesWithNoRecentCompletions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  All companies active
                </p>
              ) : (
                <ul className='space-y-1'>
                  {companiesWithNoRecentCompletions.map((c) => (
                    <li key={c.id} className='text-sm text-destructive'>
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Coverage gaps */}
            <div>
              <h3 className='text-sm font-semibold mb-2'>
                Assignments with zero completions
              </h3>
              {coverageGaps.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No gaps</p>
              ) : (
                <ul className='space-y-1'>
                  {coverageGaps.slice(0, 10).map((g, i) => (
                    <li key={i} className='text-sm'>
                      <span className='font-medium'>{g.companyName}</span>
                      {': '}
                      {g.templateTitle}
                    </li>
                  ))}
                  {coverageGaps.length > 10 && (
                    <li className='text-xs text-muted-foreground'>
                      +{coverageGaps.length - 10} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Top overdue users */}
            <div>
              <h3 className='text-sm font-semibold mb-2'>
                Users with most overdue items
              </h3>
              {topOverdueUsers.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No overdue items
                </p>
              ) : (
                <ul className='space-y-1'>
                  {topOverdueUsers.map((u, i) => (
                    <li
                      key={i}
                      className='flex items-center justify-between text-sm gap-2'
                    >
                      <span className='truncate'>{u.displayName}</span>
                      <Badge variant='destructive'>{u.overdueCount}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
