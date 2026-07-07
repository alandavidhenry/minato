'use client'

import {
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  FilePlus2,
  FileText,
  FolderOpen,
  Gauge,
  Settings,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

import { useRBAC } from '@/components/providers/rbac-provider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CUSTOMER_ROLES, UserRole } from '@/types/rbac'

interface NavItem {
  name: string
  href: string
  icon: ReactNode
  // Match only the exact path (used for dashboard/index routes)
  exact?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const iconClass = 'h-5 w-5 shrink-0'

// Build the navigation groups appropriate to the signed-in user's roles.
function useNavGroups(): NavGroup[] {
  const { isAdmin, hasRole } = useRBAC()
  const isStaff = hasRole(UserRole.TENANT_STAFF)
  const isCustomerAdmin = hasRole(UserRole.CUSTOMER_ADMIN)
  const isCustomer = CUSTOMER_ROLES.some((role) => hasRole(role))

  if (isAdmin) {
    return [
      {
        items: [
          {
            name: 'Dashboard',
            href: '/admin',
            icon: <Gauge className={iconClass} />,
            exact: true
          },
          {
            name: 'Users',
            href: '/admin/users',
            icon: <Users className={iconClass} />
          },
          {
            name: 'Companies',
            href: '/admin/companies',
            icon: <Building2 className={iconClass} />
          },
          {
            name: 'Templates',
            href: '/admin/templates',
            icon: <FileText className={iconClass} />
          },
          {
            name: 'Completions',
            href: '/admin/completions',
            icon: <CheckCircle2 className={iconClass} />
          },
          {
            name: 'Activity Logs',
            href: '/admin/activity',
            icon: <Clock className={iconClass} />
          },
          {
            name: 'Settings',
            href: '/admin/settings',
            icon: <Settings className={iconClass} />
          }
        ]
      },
      {
        label: 'Tools',
        items: [
          {
            name: 'Documents',
            href: '/documents',
            icon: <FolderOpen className={iconClass} />
          }
        ]
      }
    ]
  }

  if (isCustomer) {
    const groups: NavGroup[] = [
      {
        items: [
          {
            name: 'My Documents',
            href: '/customer/documents',
            icon: <FileText className={iconClass} />
          },
          {
            name: 'Completed Forms',
            href: '/customer/completions',
            icon: <FileCheck className={iconClass} />
          }
        ]
      }
    ]

    if (isCustomerAdmin) {
      groups.push({
        label: 'Admin',
        items: [
          {
            name: 'Team Compliance',
            href: '/customer/admin/completions',
            icon: <Users className={iconClass} />
          },
          {
            name: 'Company Templates',
            href: '/customer/admin/templates',
            icon: <FilePlus2 className={iconClass} />
          }
        ]
      })
    }

    return groups
  }

  if (isStaff) {
    return [
      {
        items: [
          {
            name: 'Documents',
            href: '/documents',
            icon: <FolderOpen className={iconClass} />
          }
        ]
      }
    ]
  }

  return []
}

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

interface SidebarRowProps {
  icon: ReactNode
  label: string
  href: string
  active?: boolean
  collapsed: boolean
  onNavigate?: () => void
}

// A single nav link, with a tooltip when collapsed to icon-only.
function SidebarRow({
  icon,
  label,
  href,
  active,
  collapsed,
  onNavigate
}: SidebarRowProps) {
  const className = cn(
    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    collapsed && 'justify-center px-0',
    active
      ? 'bg-accent text-accent-foreground'
      : 'hover:bg-accent hover:text-accent-foreground'
  )

  const element = (
    <Link href={href} onClick={onNavigate} className={className}>
      {icon}
      {!collapsed && <span className='truncate'>{label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{element}</TooltipTrigger>
        <TooltipContent side='right'>{label}</TooltipContent>
      </Tooltip>
    )
  }

  return element
}

interface SidebarContentProps {
  collapsed?: boolean
  // Called when a nav item is clicked (used to close the mobile drawer)
  onNavigate?: () => void
}

// Shared sidebar body: role-aware nav. Rendered by both the desktop rail and
// the mobile drawer; account context (profile/sign out) lives in the top bar.
export function SidebarContent({
  collapsed = false,
  onNavigate
}: SidebarContentProps) {
  const groups = useNavGroups()
  const pathname = usePathname() ?? ''

  return (
    <TooltipProvider delayDuration={0}>
      <div className='flex h-full flex-col p-3'>
        <nav className='flex-1 space-y-4'>
          {groups.map((group, index) => (
            <div key={group.label ?? index} className='space-y-1'>
              {group.label && !collapsed && (
                <p className='px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <SidebarRow
                  key={item.href}
                  icon={item.icon}
                  label={item.name}
                  href={item.href}
                  active={isActive(pathname, item)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </nav>
      </div>
    </TooltipProvider>
  )
}
