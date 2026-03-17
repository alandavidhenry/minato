'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ActivityTypeChartProps {
  readonly data: Array<{ name: string; value: number }>
}

export function ActivityTypeChart({ data }: ActivityTypeChartProps) {
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='h-64'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={data}
                cx='50%'
                cy='50%'
                labelLine={true}
                label={({ name, percent }) =>
                  `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill='#8884d8'
                dataKey='value'
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
