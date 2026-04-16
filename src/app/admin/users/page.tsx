// src/app/admin/users/page.tsx
'use client'

import { Plus, Search } from 'lucide-react'
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
  mail: string
  userPrincipalName: string
  accountEnabled: boolean
  createdDateTime?: string
  jobTitle?: string
  department?: string
  role: string
  customerCompanyId: string | null
}

// Define the valid badge variant types
type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  // Filter users when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.mail?.toLowerCase().includes(query) ||
        user.userPrincipalName.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  // Function to fetch users from API
  async function fetchUsers() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users)
      setFilteredUsers(data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle user creation
  function handleUserCreated() {
    fetchUsers()
    setShowCreateDialog(false)
    toast({ title: 'Success', description: 'User created successfully' })
  }

  // Handle user update
  function handleUserUpdated() {
    fetchUsers()
    toast({ title: 'Success', description: 'User updated successfully' })
  }

  // Extract badge variant logic into a function with proper return type
  function getRoleBadgeVariant(role: string): BadgeVariant {
    if (role === 'Platform Admin' || role === 'Tenant Admin')
      return 'destructive'
    if (role === 'Tenant Staff') return 'default'
    return 'secondary'
  }

  // Render a single user row
  function renderUserRow(user: User) {
    return (
      <TableRow key={user.id}>
        <TableCell className='font-medium'>{user.displayName}</TableCell>
        <TableCell>{user.mail || user.userPrincipalName}</TableCell>
        <TableCell>
          <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
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

  // Render table content based on loading state and filtered users
  function renderTableContent() {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            Loading users...
          </TableCell>
        </TableRow>
      )
    }

    if (filteredUsers.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className='h-24 text-center'>
            No users found.
          </TableCell>
        </TableRow>
      )
    }

    return filteredUsers.map(renderUserRow)
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

      {/* Search & Filter */}
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

      {/* Users Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableContent()}</TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onUserCreated={handleUserCreated}
      />
    </div>
  )
}
