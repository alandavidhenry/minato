// src/app/admin/page.tsx
'use client'

import { Building2, FileText, Shield, Users, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

import { RecentActivity } from '@/components/admin/recent-activity'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Types to improve readability and type safety
interface UserData {
  appRoleAssignments?: Array<{ appRoleId: string }>
}

interface Stats {
  totalUsers: number
  totalDocuments: number
  adminUsers: number
  totalCompanies: number
}

// Function extracted outside to avoid deep nesting
const isAdminUser = (user: UserData): boolean => {
  if (!user.appRoleAssignments) return false

  return user.appRoleAssignments.some(
    (role) => role.appRoleId === process.env.NEXT_PUBLIC_AZURE_AD_ADMIN_ROLE_ID
  )
}

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDocuments: 0,
    adminUsers: 0,
    totalCompanies: 0
  })

  // Moved outside of useEffect to reduce nesting
  const fetchStats = async () => {
    setIsLoading(true)
    try {
      // Fetch user stats
      const usersResponse = await fetch('/api/admin/users')
      if (usersResponse.ok) {
        const data = await usersResponse.json()
        // Using the extracted function to count admin users
        const adminCount = data.users.filter(isAdminUser).length

        setStats((prev) => ({
          ...prev,
          totalUsers: data.users.length,
          adminUsers: adminCount
        }))
      }

      // Fetch company stats
      const companiesResponse = await fetch('/api/admin/companies')
      if (companiesResponse.ok) {
        const data = await companiesResponse.json()
        setStats((prev) => ({
          ...prev,
          totalCompanies: data.companies.length
        }))
      }

      // Fetch document stats
      const docsResponse = await fetch('/api/documents/stats')
      if (docsResponse.ok) {
        const data = await docsResponse.json()
        setStats((prev) => ({
          ...prev,
          totalDocuments: data.totalDocuments
        }))
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Admin Dashboard</h1>

      <div className='grid gap-4 md:grid-cols-4'>
        {/* Stats Cards */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Users</CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='h-8 w-16 animate-pulse rounded bg-muted'></div>
            ) : (
              <div className='text-2xl font-bold'>{stats.totalUsers}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Admin Users</CardTitle>
            <Shield className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='h-8 w-16 animate-pulse rounded bg-muted'></div>
            ) : (
              <div className='text-2xl font-bold'>{stats.adminUsers}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Companies
            </CardTitle>
            <Building2 className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='h-8 w-16 animate-pulse rounded bg-muted'></div>
            ) : (
              <div className='text-2xl font-bold'>{stats.totalCompanies}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Documents
            </CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='h-8 w-16 animate-pulse rounded bg-muted'></div>
            ) : (
              <div className='text-2xl font-bold'>{stats.totalDocuments}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Clock className='h-5 w-5' />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span>Azure AD Connection</span>
                <span className='flex items-center text-green-500'>
                  <svg viewBox='0 0 10 10' className='h-2.5 w-2.5 fill-current'>
                    <circle cx='5' cy='5' r='5' />
                  </svg>
                  <span className='ml-1'>Active</span>
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span>Storage Service</span>
                <span className='flex items-center text-green-500'>
                  <svg viewBox='0 0 10 10' className='h-2.5 w-2.5 fill-current'>
                    <circle cx='5' cy='5' r='5' />
                  </svg>
                  <span className='ml-1'>Active</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
