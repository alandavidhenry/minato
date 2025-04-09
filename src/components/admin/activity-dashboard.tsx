// src/components/admin/activity-dashboard.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityType } from '@/lib/activity-logger'

interface ActivityLog {
  id: string
  userId: string
  userName: string
  fileName: string
  activityType: ActivityType
  timestamp: string
}

interface ActivityDashboardProps {
  readonly logs: ActivityLog[]
}

export function ActivityDashboard({ logs }: ActivityDashboardProps) {
  const [dailyActivity, setDailyActivity] = useState<any[]>([])
  const [activityByType, setActivityByType] = useState<any[]>([])
  const [activityByUser, setActivityByUser] = useState<any[]>([])

  useEffect(() => {
    if (logs.length === 0) return

    // Process data for charts
    function processActivityData() {
      // Group by date for daily activity
      const dailyGroups = logs.reduce(
        (acc, log) => {
          const date = new Date(log.timestamp).toLocaleDateString()
          if (!acc[date]) {
            acc[date] = { date, count: 0 }
          }
          acc[date].count++
          return acc
        },
        {} as Record<string, { date: string; count: number }>
      )

      // Group by activity type
      const typeGroups = logs.reduce(
        (acc, log) => {
          if (!acc[log.activityType]) {
            acc[log.activityType] = {
              name: formatActivityType(log.activityType),
              value: 0
            }
          }
          acc[log.activityType].value++
          return acc
        },
        {} as Record<string, { name: string; value: number }>
      )

      // Group by user
      const userGroups = logs.reduce(
        (acc, log) => {
          if (!acc[log.userId]) {
            acc[log.userId] = { name: log.userName, value: 0 }
          }
          acc[log.userId].value++
          return acc
        },
        {} as Record<string, { name: string; value: number }>
      )

      // Convert to arrays for charts
      setDailyActivity(
        Object.values(dailyGroups).sort((a, b) => a.date.localeCompare(b.date))
      )
      setActivityByType(Object.values(typeGroups))

      // Top 5 most active users
      setActivityByUser(
        Object.values(userGroups)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      )
    }

    processActivityData()
  }, [logs])

  function formatActivityType(type: ActivityType): string {
    switch (type) {
      case ActivityType.VIEW:
        return 'View'
      case ActivityType.DOWNLOAD:
        return 'Download'
      case ActivityType.UPLOAD:
        return 'Upload'
      case ActivityType.NEW_VERSION:
        return 'New Version'
      default:
        return type
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {/* Daily Activity Chart */}
      <Card className='col-span-full'>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-80'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={dailyActivity}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='date' />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey='count' fill='#8884d8' name='Activities' />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Activity by Type Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={activityByType}
                  cx='50%'
                  cy='50%'
                  labelLine={true}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill='#8884d8'
                  dataKey='value'
                >
                  {activityByType.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={
                        COLORS[
                          activityByType.findIndex(
                            (item) => item.name === entry.name
                          ) % COLORS.length
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Users Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Most Active Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='h-64'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={activityByUser}
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
    </div>
  )
}
