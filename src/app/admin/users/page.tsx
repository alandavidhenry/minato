// src/app/admin/users/page.tsx
'use client'

import { ChevronDown, ChevronRight, Plus, Search } from 'lucide-react'
import { useState, useEffect } from 'react'

import { CreateUserDialog } from '@/components/admin/create-user-dialog'
import { UserActionsDropdown } from '@/components/admin/user-actions-dropdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'

interface User {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string | null
  accountEnabled: boolean
  createdDateTime?: string
  role: string
  jobRole: string | null
  lineManagerId: string | null
  customerCompanyId: string | null
  customerCompanyName: string | null
}

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary'

const INTERNAL_ROLES = new Set([
  'Platform Admin',
  'Tenant Admin',
  'Tenant Staff'
])

interface UserGroup {
  id: string
  label: string
  users: User[]
}

function groupUsers(users: User[]): UserGroup[] {
  const groups: UserGroup[] = []

  const internal = users.filter((u) => INTERNAL_ROLES.has(u.role))
  if (internal.length > 0) {
    groups.push({
      id: '__internal__',
      label: 'Internal Staff',
      users: internal
    })
  }

  const byCompany = new Map<string, { label: string; users: User[] }>()
  for (const user of users.filter((u) => !INTERNAL_ROLES.has(u.role))) {
    const key = user.customerCompanyId ?? '__unassigned__'
    const label = user.customerCompanyName ?? 'Unassigned'
    if (!byCompany.has(key)) byCompany.set(key, { label, users: [] })
    byCompany.get(key)!.users.push(user)
  }

  const sorted = [...byCompany.entries()].sort(([, a], [, b]) =>
    a.label.localeCompare(b.label)
  )
  for (const [id, { label, users }] of sorted) {
    groups.push({ id, label, users })
  }

  return groups
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data.users)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleUserCreated() {
    fetchUsers()
    setShowCreateDialog(false)
    toast({ title: 'Success', description: 'User created successfully' })
  }

  function handleUserUpdated() {
    fetchUsers()
    toast({ title: 'Success', description: 'User updated successfully' })
  }

  function getRoleBadgeVariant(role: string): BadgeVariant {
    if (role === 'Platform Admin' || role === 'Tenant Admin')
      return 'destructive'
    if (role === 'Tenant Staff') return 'default'
    return 'secondary'
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const query = searchQuery.toLowerCase().trim()
  const filteredUsers = query
    ? users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query) ||
          u.mail?.toLowerCase().includes(query) ||
          u.userPrincipalName?.toLowerCase().includes(query)
      )
    : users

  const groups = groupUsers(filteredUsers)

  function renderUserRow(user: User) {
    return (
      <TableRow key={user.id}>
        <TableCell className='font-medium'>{user.displayName}</TableCell>
        <TableCell>
          {user.mail ?? (
            <span className='text-muted-foreground italic text-xs'>
              No email — kiosk
            </span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
        </TableCell>
        <TableCell className='text-muted-foreground'>
          {user.jobRole ?? '—'}
        </TableCell>
        <TableCell>
          <Badge
            variant={user.accountEnabled ? 'outline' : 'secondary'}
            className={user.accountEnabled ? 'bg-green-100 text-green-800' : ''}
          >
            {user.accountEnabled ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell className='text-right'>
          <UserActionsDropdown
            user={user}
            onUserUpdated={handleUserUpdated}
            userRole={user.role}
          />
        </TableCell>
      </TableRow>
    )
  }

  function renderGroup(group: UserGroup) {
    const isExpanded = expandedGroups.has(group.id)
    const Icon = isExpanded ? ChevronDown : ChevronRight
    return (
      <div key={group.id} className='rounded-md border'>
        <button
          type='button'
          className='flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50 transition-colors rounded-md'
          onClick={() => toggleGroup(group.id)}
        >
          <Icon className='h-4 w-4 text-muted-foreground shrink-0' />
          <span>{group.label}</span>
          <span className='ml-auto font-normal text-muted-foreground'>
            {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
          </span>
        </button>
        {isExpanded && (
          <div className='border-t'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Job Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{group.users.map(renderUserRow)}</TableBody>
            </Table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>User Management</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Add User
        </Button>
      </div>

      <div className='flex items-center space-x-2'>
        <div className='relative flex-1'>
          <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            type='search'
            placeholder='Search users...'
            className='pl-8'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className='rounded-md border'>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  Loading users...
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : groups.length === 0 ? (
        <div className='rounded-md border'>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center'>
                  No users found.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className='space-y-3'>{groups.map(renderGroup)}</div>
      )}

      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onUserCreated={handleUserCreated}
      />
    </div>
  )
}
