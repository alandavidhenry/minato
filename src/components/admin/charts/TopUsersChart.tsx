'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TopUsersChartProps {
  readonly data: Array<{ name: string; value: number }>
}

export function TopUsersChart({ data }: TopUsersChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Most Active Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='h-64'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart
              data={data}
              layout='vertical'
              margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis type='number' />
              <YAxis type='category' dataKey='name' />
              <Tooltip />
              <Legend />
              <Bar dataKey='value' fill='#82ca9d' name='Activities' />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
