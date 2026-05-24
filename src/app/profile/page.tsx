'use client'

import { Loader2, Save, ShieldCheck } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import type { ProfilePermissions } from '@/lib/user-database'

interface ProfileUser {
  id: string
  email: string | null
  displayName: string
  role: string
  jobRole: string | null
  createdAt: string
  customerCompanyId: string | null
  companyName: string | null
  hasPassword: boolean
}

export default function ProfilePage() {
  const { update: updateSession } = useSession()
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [permissions, setPermissions] = useState<ProfilePermissions | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()
      setUser(data.user)
      setPermissions(data.permissions)
      setDisplayName(data.user.displayName)
      setEmail(data.user.email ?? '')
      setJobRole(data.user.jobRole ?? '')
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load profile.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const body: Record<string, string | null> = {}
      if (permissions?.canEditDisplayName) body.displayName = displayName
      if (permissions?.canEditEmail && user?.email !== null)
        body.email = email || null
      if (permissions?.canEditJobRole) body.jobRole = jobRole || null

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const err = await res.json()
        const messages: Record<string, string> = {
          INVALID_NAME: 'Display name cannot be empty.',
          INVALID_EMAIL: 'Please enter a valid email address.',
          EMAIL_TAKEN: 'That email is already in use.'
        }
        throw new Error(messages[err.error] ?? 'Failed to save profile.')
      }

      await updateSession()
      await fetchProfile()
      toast({ title: 'Saved', description: 'Profile updated successfully.' })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save profile.',
        variant: 'destructive'
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match.',
        variant: 'destructive'
      })
      return
    }
    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive'
      })
      return
    }
    setIsSavingPassword(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(
          err.error === 'WRONG_PASSWORD'
            ? 'Current password is incorrect.'
            : 'Failed to change password.'
        )
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: 'Changed', description: 'Password updated successfully.' })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to change password.',
        variant: 'destructive'
      })
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (isLoading || !user || !permissions) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const canEditAny =
    permissions.canEditDisplayName ||
    permissions.canEditEmail ||
    permissions.canEditJobRole

  return (
    <div className='max-w-2xl mx-auto py-8 px-4 space-y-6'>
      <h1 className='text-3xl font-bold'>Your Profile</h1>

      {/* Profile Information */}
      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              {canEditAny
                ? 'Update your personal details.'
                : 'Your profile details are managed by your administrator.'}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-4'>
            <div className='grid gap-2'>
              <Label htmlFor='displayName'>Display Name</Label>
              <Input
                id='displayName'
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!permissions.canEditDisplayName || isSavingProfile}
              />
            </div>

            {user.email !== null && (
              <div className='grid gap-2'>
                <Label htmlFor='email'>Email Address</Label>
                <Input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!permissions.canEditEmail || isSavingProfile}
                />
              </div>
            )}

            <div className='grid gap-2'>
              <Label htmlFor='jobRole'>Job Role</Label>
              <Input
                id='jobRole'
                value={jobRole}
                placeholder='e.g. Site Manager'
                onChange={(e) => setJobRole(e.target.value)}
                disabled={!permissions.canEditJobRole || isSavingProfile}
              />
            </div>
          </CardContent>

          {canEditAny && (
            <CardFooter>
              <Button type='submit' disabled={isSavingProfile}>
                {isSavingProfile ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>

      {/* Change Password */}
      {user.hasPassword && (
        <Card>
          <form onSubmit={handleChangePassword}>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Enter your current password and choose a new one.
              </CardDescription>
            </CardHeader>

            <CardContent className='space-y-4'>
              <div className='grid gap-2'>
                <Label htmlFor='currentPassword'>Current Password</Label>
                <PasswordInput
                  id='currentPassword'
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isSavingPassword}
                  autoComplete='current-password'
                />
              </div>

              <Separator />

              <div className='grid gap-2'>
                <Label htmlFor='newPassword'>New Password</Label>
                <PasswordInput
                  id='newPassword'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSavingPassword}
                  autoComplete='new-password'
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='confirmPassword'>Confirm New Password</Label>
                <PasswordInput
                  id='confirmPassword'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSavingPassword}
                  autoComplete='new-password'
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type='submit'
                disabled={
                  isSavingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {isSavingPassword ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Updating…
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ShieldCheck className='h-5 w-5' />
            Account Details
          </CardTitle>
        </CardHeader>

        <CardContent className='space-y-3 text-sm'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Role</span>
            <Badge variant='secondary'>{user.role}</Badge>
          </div>

          {user.companyName && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Company</span>
              <span>{user.companyName}</span>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>Member since</span>
            <span>
              {new Date(user.createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
