'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MonthlyThroughputChartProps {
  readonly data: Array<{
    month: string
    assignments: number
    completions: number
  }>
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function MonthlyThroughputChart({ data }: MonthlyThroughputChartProps) {
  const formatted = data.map((d) => ({ ...d, label: formatMonth(d.month) }))

  return (
    <Card className='col-span-full'>
      <CardHeader>
        <CardTitle>Assignments vs Completions — Last 12 Months</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='h-72'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={formatted}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='label' />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey='assignments'
                fill='#6366f1'
                name='Assignments created'
                isAnimationActive={false}
              />
              <Bar
                dataKey='completions'
                fill='#22c55e'
                name='Completions'
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
