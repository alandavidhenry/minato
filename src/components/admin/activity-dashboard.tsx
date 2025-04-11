'use client'

import { useState, useEffect } from 'react'

import { ActivityType } from '@/lib/activity-logger'

import { ActivityTypeChart } from './charts/ActivityTypeChart'
import { DailyActivityChart } from './charts/DailyActivityChart'
import { TopUsersChart } from './charts/TopUsersChart'
import { processActivityData } from './utils/activity-data-processor'

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
  const [chartData, setChartData] = useState({
    dailyActivity: [],
    activityByType: [],
    activityByUser: []
  })

  useEffect(() => {
    if (logs.length === 0) return

    // Process data for charts
    const processedData = processActivityData(logs)
    setChartData(processedData)
  }, [logs])

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      {/* Daily Activity Chart */}
      <DailyActivityChart data={chartData.dailyActivity} />

      {/* Activity by Type Chart */}
      <ActivityTypeChart data={chartData.activityByType} />

      {/* Top Users Chart */}
      <TopUsersChart data={chartData.activityByUser} />
    </div>
  )
}
