'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CompanyCompletionRateChartProps {
  readonly data: Array<{
    companyName: string
    rate: number
    completedAssignments: number
    totalAssignments: number
  }>
}

function barColor(rate: number): string {
  if (rate < 50) return '#ef4444'
  if (rate < 80) return '#f59e0b'
  return '#22c55e'
}

export function CompanyCompletionRateChart({
  data
}: CompanyCompletionRateChartProps) {
  const chartHeight = Math.max(200, data.length * 36)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate by Company</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground py-8 text-center'>
            No assignments yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Rate by Company</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart
              data={data}
              layout='vertical'
              margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                type='number'
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type='category'
                dataKey='companyName'
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(_value, _name, props) => {
                  const { completedAssignments, totalAssignments, rate } =
                    props.payload as {
                      completedAssignments: number
                      totalAssignments: number
                      rate: number
                    }
                  return [
                    `${rate}% (${completedAssignments} / ${totalAssignments} assignments)`,
                    'Completion rate'
                  ]
                }}
              />
              <Bar
                dataKey='rate'
                name='Completion rate'
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.companyName} fill={barColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
