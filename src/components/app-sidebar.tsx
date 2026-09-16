'use client'

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck,
  FilePlus2,
  FileText,
  FolderOpen,
  Gauge,
  History,
  Settings,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ComponentType } from 'react'

import { useRBAC } from '@/components/providers/rbac-provider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CUSTOMER_ROLES, UserRole } from '@/types/rbac'

export interface NavItem {
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
  // Match only the exact path (used for dashboard/index routes)
  exact?: boolean
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

/*
  Every destination is its own row with its own icon, so the sidebar reads as a
  column of icons when collapsed and as labelled rows when hovered. Groups only
  provide headings — they are not themselves navigable.
*/
export function useNavGroups(): NavGroup[] {
  const { isAdmin, hasRole } = useRBAC()
  const isStaff = hasRole(UserRole.TENANT_STAFF)
  const isCustomerAdmin = hasRole(UserRole.CUSTOMER_ADMIN)
  const isCustomer = CUSTOMER_ROLES.some((role) => hasRole(role))

  if (isAdmin) {
    return [
      {
        id: 'overview',
        label: 'Overview',
        items: [{ name: 'Dashboard', href: '/admin', icon: Gauge, exact: true }]
      },
      {
        id: 'organisation',
        label: 'Organisation',
        items: [
          { name: 'Companies', href: '/admin/companies', icon: Building2 },
          { name: 'Users', href: '/admin/users', icon: Users }
        ]
      },
      {
        id: 'documents',
        label: 'Documents',
        items: [
          { name: 'Templates', href: '/admin/templates', icon: FileText },
          { name: 'File library', href: '/documents', icon: FolderOpen }
        ]
      },
      {
        id: 'compliance',
        label: 'Compliance',
        items: [
          {
            name: 'Completions',
            href: '/admin/completions',
            icon: CheckCircle2
          },
          {
            name: 'Outstanding',
            href: '/admin/completions/outstanding',
            icon: AlertTriangle
          },
          {
            name: 'History',
            href: '/admin/completions/history',
            icon: History
          },
          {
            name: 'Assignments',
            href: '/admin/assignments',
            icon: ClipboardList
          },
          { name: 'Activity logs', href: '/admin/activity', icon: Clock }
        ]
      },
      {
        id: 'settings',
        label: 'Settings',
        items: [{ name: 'General', href: '/admin/settings', icon: Settings }]
      }
    ]
  }

  if (isCustomer) {
    const groups: NavGroup[] = [
      {
        id: 'training',
        label: 'My training',
        items: [
          {
            name: 'My documents',
            href: '/customer/documents',
            icon: FileText
          },
          {
            name: 'Completed forms',
            href: '/customer/completions',
            icon: FileCheck
          }
        ]
      }
    ]

    if (isCustomerAdmin) {
      groups.push({
        id: 'team',
        label: 'Team',
        items: [
          {
            name: 'Team compliance',
            href: '/customer/admin/completions',
            icon: Users
          },
          {
            name: 'Company templates',
            href: '/customer/admin/templates',
            icon: FilePlus2
          }
        ]
      })
    }

    return groups
  }

  if (isStaff) {
    return [
      {
        id: 'documents',
        label: 'Documents',
        items: [{ name: 'File library', href: '/documents', icon: FolderOpen }]
      }
    ]
  }

  return []
}

function matchesItem(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

/*
  Several items share a prefix (/admin/completions also prefixes
  /admin/completions/outstanding), so the active item is the longest match
  rather than the first.
*/
export function findActiveItem(groups: NavGroup[], pathname: string) {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => matchesItem(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

interface SidebarNavProps {
  // Labels are present in the DOM either way; expanded fades them in and the
  // tooltips out, so nothing reflows vertically as the panel widens.
  readonly expanded: boolean
  readonly onNavigate?: () => void
}

export function SidebarNav({ expanded, onNavigate }: SidebarNavProps) {
  const pathname = usePathname() ?? ''
  const groups = useNavGroups()
  const activeItem = findActiveItem(groups, pathname)

  return (
    <nav className='flex flex-col gap-3 p-2'>
      {groups.map((group) => (
        <div key={group.id} className='flex flex-col gap-0.5'>
          <p
            aria-hidden={!expanded}
            className={cn(
              'flex h-6 items-center overflow-hidden whitespace-nowrap px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-opacity duration-150',
              expanded ? 'opacity-100' : 'opacity-0'
            )}
          >
            {group.label}
          </p>

          {group.items.map((item) => {
            const Icon = item.icon
            const active = item.href === activeItem?.href

            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-md px-[11px] transition-colors',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <Icon className='h-[18px] w-[18px] shrink-0' />
                <span
                  className={cn(
                    'truncate whitespace-nowrap text-sm transition-opacity duration-150',
                    expanded ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )

            // Collapsed rows have no visible label, so they get a tooltip.
            if (expanded) return <div key={item.href}>{link}</div>

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side='right'>{item.name}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
