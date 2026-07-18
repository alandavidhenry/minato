// src/app/admin/settings/page.tsx
'use client'

import { Loader2, Save, Shield, UserCog } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import type { ProfilePermissions } from '@/lib/user-database'

type GeneralSettingValue = string | boolean
type SecuritySettingValue = number | boolean

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'Minato',
    supportEmail: 'support@example.com',
    allowGuestAccess: false
  })

  const [profilePermissions, setProfilePermissions] =
    useState<ProfilePermissions>({
      canEditDisplayName: true,
      canEditEmail: true,
      canEditJobRole: true
    })
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true)
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)

  const fetchPermissions = useCallback(async () => {
    setIsLoadingPermissions(true)
    try {
      const res = await fetch('/api/admin/settings/profile-permissions')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProfilePermissions(data.permissions)
    } catch {
      // keep defaults on error
    } finally {
      setIsLoadingPermissions(false)
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  async function handleSavePermissions(e: React.FormEvent) {
    e.preventDefault()
    setIsSavingPermissions(true)
    try {
      const res = await fetch('/api/admin/settings/profile-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePermissions)
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Success', description: 'Profile permissions saved.' })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save permissions.',
        variant: 'destructive'
      })
    } finally {
      setIsSavingPermissions(false)
    }
  }

  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    passwordExpireDays: 90,
    enforcePasswordHistory: 5,
    sessionTimeout: 30,
    allowMultipleLogins: true
  })

  function handleGeneralSettingsChange(
    field: string,
    value: GeneralSettingValue
  ) {
    setGeneralSettings((prev) => ({ ...prev, [field]: value }))
  }

  function handleSecuritySettingsChange(
    field: string,
    value: SecuritySettingValue
  ) {
    setSecuritySettings((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      // For now, we'll just simulate saving the settings
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({ title: 'Success', description: 'Settings saved successfully' })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold'>Settings</h1>

      <Tabs defaultValue='general'>
        <TabsList>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='security'>Security</TabsTrigger>
          <TabsTrigger value='profiles'>User Profiles</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value='general'>
          <Card>
            <form onSubmit={handleSaveSettings}>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure the general settings for your Minato platform.
                </CardDescription>
              </CardHeader>

              <CardContent className='space-y-4'>
                <div className='grid gap-2'>
                  <Label htmlFor='siteName'>Portal Name</Label>
                  <Input
                    id='siteName'
                    value={generalSettings.siteName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleGeneralSettingsChange('siteName', e.target.value)
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='supportEmail'>Support Email</Label>
                  <Input
                    id='supportEmail'
                    type='email'
                    value={generalSettings.supportEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleGeneralSettingsChange(
                        'supportEmail',
                        e.target.value
                      )
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className='flex items-center gap-2'>
                  <Switch
                    id='allowGuestAccess'
                    checked={generalSettings.allowGuestAccess}
                    onCheckedChange={(checked: boolean) =>
                      handleGeneralSettingsChange('allowGuestAccess', checked)
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor='allowGuestAccess'>
                    Allow guest access to view documents
                  </Label>
                </div>
              </CardContent>

              <CardFooter>
                <Button type='submit' disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className='mr-2 h-4 w-4' />
                      Save Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value='security'>
          <Card>
            <form onSubmit={handleSaveSettings}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Shield className='h-5 w-5' />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure security settings for your Minato platform.
                </CardDescription>
              </CardHeader>

              <CardContent className='space-y-4'>
                <div className='grid gap-2'>
                  <Label htmlFor='passwordMinLength'>
                    Password Minimum Length
                  </Label>
                  <Input
                    id='passwordMinLength'
                    type='number'
                    min={6}
                    max={16}
                    value={securitySettings.passwordMinLength}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleSecuritySettingsChange(
                        'passwordMinLength',
                        Number.parseInt(e.target.value)
                      )
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='passwordExpireDays'>
                    Password Expiration (days)
                  </Label>
                  <Input
                    id='passwordExpireDays'
                    type='number'
                    min={0}
                    max={365}
                    value={securitySettings.passwordExpireDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleSecuritySettingsChange(
                        'passwordExpireDays',
                        Number.parseInt(e.target.value)
                      )
                    }
                    disabled={isLoading}
                  />
                  <p className='text-xs text-muted-foreground'>
                    Set to 0 to disable password expiration
                  </p>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='enforcePasswordHistory'>
                    Enforce Password History
                  </Label>
                  <Input
                    id='enforcePasswordHistory'
                    type='number'
                    min={0}
                    max={24}
                    value={securitySettings.enforcePasswordHistory}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleSecuritySettingsChange(
                        'enforcePasswordHistory',
                        parseInt(e.target.value)
                      )
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='sessionTimeout'>
                    Session Timeout (minutes)
                  </Label>
                  <Input
                    id='sessionTimeout'
                    type='number'
                    min={5}
                    max={1440}
                    value={securitySettings.sessionTimeout}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleSecuritySettingsChange(
                        'sessionTimeout',
                        parseInt(e.target.value)
                      )
                    }
                    disabled={isLoading}
                  />
                </div>

                <div className='flex items-center gap-2'>
                  <Switch
                    id='allowMultipleLogins'
                    checked={securitySettings.allowMultipleLogins}
                    onCheckedChange={(checked: boolean) =>
                      handleSecuritySettingsChange(
                        'allowMultipleLogins',
                        checked
                      )
                    }
                    disabled={isLoading}
                  />
                  <Label htmlFor='allowMultipleLogins'>
                    Allow multiple simultaneous logins
                  </Label>
                </div>
              </CardContent>

              <CardFooter>
                <Button type='submit' disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className='mr-2 h-4 w-4' />
                      Save Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* User Profile Permissions */}
        <TabsContent value='profiles'>
          <Card>
            <form onSubmit={handleSavePermissions}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <UserCog className='h-5 w-5' />
                  User Profile Permissions
                </CardTitle>
                <CardDescription>
                  Choose which profile fields customer users may edit
                  themselves. Staff and admin users can always edit all their
                  own fields. Password changes are always permitted.
                </CardDescription>
              </CardHeader>

              <CardContent className='space-y-4'>
                {isLoadingPermissions ? (
                  <div className='flex items-center gap-2 text-muted-foreground text-sm'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Loading…
                  </div>
                ) : (
                  <>
                    <div className='flex items-center gap-3'>
                      <Switch
                        id='canEditDisplayName'
                        checked={profilePermissions.canEditDisplayName}
                        onCheckedChange={(checked) =>
                          setProfilePermissions((p) => ({
                            ...p,
                            canEditDisplayName: checked
                          }))
                        }
                        disabled={isSavingPermissions}
                      />
                      <Label htmlFor='canEditDisplayName'>
                        Allow users to edit their display name
                      </Label>
                    </div>

                    <div className='flex items-center gap-3'>
                      <Switch
                        id='canEditEmail'
                        checked={profilePermissions.canEditEmail}
                        onCheckedChange={(checked) =>
                          setProfilePermissions((p) => ({
                            ...p,
                            canEditEmail: checked
                          }))
                        }
                        disabled={isSavingPermissions}
                      />
                      <Label htmlFor='canEditEmail'>
                        Allow users to edit their email address
                      </Label>
                    </div>

                    <div className='flex items-center gap-3'>
                      <Switch
                        id='canEditJobRole'
                        checked={profilePermissions.canEditJobRole}
                        onCheckedChange={(checked) =>
                          setProfilePermissions((p) => ({
                            ...p,
                            canEditJobRole: checked
                          }))
                        }
                        disabled={isSavingPermissions}
                      />
                      <Label htmlFor='canEditJobRole'>
                        Allow users to edit their job role
                      </Label>
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  type='submit'
                  disabled={isSavingPermissions || isLoadingPermissions}
                >
                  {isSavingPermissions ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className='mr-2 h-4 w-4' />
                      Save Permissions
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
