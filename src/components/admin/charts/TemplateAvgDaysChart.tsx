'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TemplateAvgDaysChartProps {
  readonly data: Array<{
    templateTitle: string
    avgDays: number
    completionCount: number
  }>
}

export function TemplateAvgDaysChart({ data }: TemplateAvgDaysChartProps) {
  const chartHeight = Math.max(200, data.length * 36)

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avg Days to Completion by Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground py-8 text-center'>
            No completions yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avg Days to Completion by Template</CardTitle>
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
              <XAxis type='number' />
              <YAxis
                type='category'
                dataKey='templateTitle'
                width={130}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(_value, _name, props) => {
                  const { avgDays, completionCount } = props.payload as {
                    avgDays: number
                    completionCount: number
                  }
                  return [
                    `${avgDays} days (${completionCount} completions)`,
                    'Avg days'
                  ]
                }}
              />
              <Bar
                dataKey='avgDays'
                fill='#8b5cf6'
                name='Avg days'
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
