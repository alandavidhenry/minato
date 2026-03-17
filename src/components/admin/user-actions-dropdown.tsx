'use client'

import {
  MoreHorizontal,
  Edit,
  Trash2,
  UserCog,
  XCircle,
  CheckCircle,
  KeyRound
} from 'lucide-react'
import { useState } from 'react'

import { ChangeRoleDialog } from './change-role-dialog'
import { DeleteUserDialog } from './delete-user-dialog'
import { ResetPasswordDialog } from './reset-password-dialog'
import { UserDetailsDialog } from './user-details-dialog'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
}

interface UserActionsDropdownProps {
  readonly user: User
  readonly userRole: string
  readonly onUserUpdated: () => void
}

export function UserActionsDropdown({
  user,
  userRole,
  onUserUpdated
}: UserActionsDropdownProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showChangeRoleDialog, setShowChangeRoleDialog] = useState(false)

  // Toggle user account status
  async function toggleUserStatus() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountEnabled: !user.accountEnabled
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update user status')
      }

      toast({
        title: 'Success',
        description: `User account ${user.accountEnabled ? 'disabled' : 'enabled'} successfully.`
      })

      onUserUpdated()
    } catch (error) {
      console.error('Error updating user status:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update user status',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Open menu</span>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => setShowDetailsDialog(true)}>
            <Edit className='mr-2 h-4 w-4' />
            View Details
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowChangeRoleDialog(true)}>
            <UserCog className='mr-2 h-4 w-4' />
            Change Role
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowResetPasswordDialog(true)}>
            <KeyRound className='mr-2 h-4 w-4' />
            Reset Password
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={toggleUserStatus} disabled={isLoading}>
            {user.accountEnabled ? (
              <>
                <XCircle className='mr-2 h-4 w-4' />
                Disable Account
              </>
            ) : (
              <>
                <CheckCircle className='mr-2 h-4 w-4' />
                Enable Account
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className='text-destructive focus:text-destructive'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Details Dialog */}
      {showDetailsDialog && (
        <UserDetailsDialog
          user={user}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onUserUpdated={onUserUpdated}
        />
      )}

      {/* Reset Password Dialog */}
      {showResetPasswordDialog && (
        <ResetPasswordDialog
          userId={user.id}
          userName={user.displayName}
          open={showResetPasswordDialog}
          onOpenChange={setShowResetPasswordDialog}
          onPasswordReset={onUserUpdated}
        />
      )}

      {/* Delete User Dialog */}
      {showDeleteDialog && (
        <DeleteUserDialog
          userId={user.id}
          userName={user.displayName}
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onUserDeleted={onUserUpdated}
        />
      )}

      {/* Change Role Dialog */}
      {showChangeRoleDialog && (
        <ChangeRoleDialog
          userId={user.id}
          userName={user.displayName}
          currentRole={userRole}
          open={showChangeRoleDialog}
          onOpenChange={setShowChangeRoleDialog}
          onRoleChanged={onUserUpdated}
        />
      )}
    </>
  )
}
