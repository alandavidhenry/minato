'use client'

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Shield,
  TrendingUp,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { RecentCompletions } from '@/components/admin/recent-completions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ADMIN_ROLES, type UserRole } from '@/types/rbac'

interface KPIs {
  activeAssignments: number
  completedThisMonth: number
  completedThisWeek: number
  outstanding: number
  overdue: number
}

interface SecondaryStats {
  totalUsers: number
  adminUsers: number
  totalCompanies: number
  totalDocuments: number
}

interface UserData {
  role: UserRole
}

function formatDateParam(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStartOfMonthParam(): string {
  const now = new Date()
  return formatDateParam(new Date(now.getFullYear(), now.getMonth(), 1))
}

function getStartOfWeekParam(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  return formatDateParam(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
  )
}

export default function AdminDashboardPage() {
  const [kpisLoading, setKpisLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [kpis, setKpis] = useState<KPIs>({
    activeAssignments: 0,
    completedThisMonth: 0,
    completedThisWeek: 0,
    outstanding: 0,
    overdue: 0
  })
  const [stats, setStats] = useState<SecondaryStats>({
    totalUsers: 0,
    adminUsers: 0,
    totalCompanies: 0,
    totalDocuments: 0
  })

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const res = await fetch('/api/admin/dashboard/stats')
        if (res.ok) {
          const data = await res.json()
          setKpis(data)
        }
      } catch (error) {
        console.error('Error fetching dashboard KPIs:', error)
      } finally {
        setKpisLoading(false)
      }
    }

    async function fetchSecondaryStats() {
      try {
        const [usersRes, companiesRes, docsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/companies'),
          fetch('/api/documents/stats')
        ])

        if (usersRes.ok) {
          const data = await usersRes.json()
          const adminCount = data.users.filter((u: UserData) =>
            ADMIN_ROLES.includes(u.role)
          ).length
          setStats((prev) => ({
            ...prev,
            totalUsers: data.users.length,
            adminUsers: adminCount
          }))
        }
        if (companiesRes.ok) {
          const data = await companiesRes.json()
          setStats((prev) => ({
            ...prev,
            totalCompanies: data.companies.length
          }))
        }
        if (docsRes.ok) {
          const data = await docsRes.json()
          setStats((prev) => ({
            ...prev,
            totalDocuments: data.totalDocuments
          }))
        }
      } catch (error) {
        console.error('Error fetching secondary stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchKPIs()
    fetchSecondaryStats()
  }, [])

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Admin Dashboard</h1>

      {/* Compliance KPI tiles */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        <Link href='/admin/assignments'>
          <Card className='cursor-pointer transition-colors hover:bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Active Assignments
              </CardTitle>
              <ClipboardList className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold'>
                  {kpis.activeAssignments}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href={`/admin/completions/history?from=${getStartOfWeekParam()}`}>
          <Card className='cursor-pointer transition-colors hover:bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Completed This Week
              </CardTitle>
              <TrendingUp className='h-4 w-4 text-green-500' />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold text-green-600'>
                  {kpis.completedThisWeek}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/admin/completions/history?from=${getStartOfMonthParam()}`}
        >
          <Card className='cursor-pointer transition-colors hover:bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Completed This Month
              </CardTitle>
              <TrendingUp className='h-4 w-4 text-green-500' />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold text-green-600'>
                  {kpis.completedThisMonth}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href='/admin/completions/outstanding'>
          <Card className='cursor-pointer transition-colors hover:bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Outstanding</CardTitle>
              <AlertTriangle className='h-4 w-4 text-amber-500' />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold text-amber-600'>
                  {kpis.outstanding}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href='/admin/completions/outstanding?overdueOnly=true'>
          <Card className='cursor-pointer transition-colors hover:bg-muted/50'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Overdue</CardTitle>
              <AlertTriangle className='h-4 w-4 text-red-500' />
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold text-red-600'>
                  {kpis.overdue}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent completions feed + quick actions */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5' />
              Recent Completions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentCompletions />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <Link href='/admin/completions' className='block'>
              <Button variant='outline' className='w-full justify-between'>
                View all completions
                <ArrowRight className='h-4 w-4' />
              </Button>
            </Link>
            <Link href='/admin/assignments' className='block'>
              <Button variant='outline' className='w-full justify-between'>
                View all assignments
                <ArrowRight className='h-4 w-4' />
              </Button>
            </Link>
            <Link href='/admin/completions/outstanding' className='block'>
              <Button variant='outline' className='w-full justify-between'>
                View outstanding completions
                <ArrowRight className='h-4 w-4' />
              </Button>
            </Link>
            <Link href='/admin/companies' className='block'>
              <Button variant='outline' className='w-full justify-between'>
                Manage companies &amp; assignments
                <ArrowRight className='h-4 w-4' />
              </Button>
            </Link>
            <Link href='/admin/activity' className='block'>
              <Button variant='outline' className='w-full justify-between'>
                View activity log
                <ArrowRight className='h-4 w-4' />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats — system overview */}
      <div>
        <h2 className='mb-4 text-lg font-semibold'>System Overview</h2>
        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Users</CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
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
              {statsLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
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
              {statsLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
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
              {statsLoading ? (
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              ) : (
                <div className='text-2xl font-bold'>{stats.totalDocuments}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
