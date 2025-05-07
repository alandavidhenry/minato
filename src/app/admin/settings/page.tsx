// src/app/admin/settings/page.tsx
'use client'

import { Loader2, Save, Shield } from 'lucide-react'
import { useState } from 'react'

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

type GeneralSettingValue = string | boolean
type SecuritySettingValue = number | boolean

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'Document Portal',
    supportEmail: 'support@example.com',
    allowGuestAccess: false
  })

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
          <TabsTrigger value='azure'>Azure Integration</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value='general'>
          <Card>
            <form onSubmit={handleSaveSettings}>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure the general settings for your document portal.
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
                  Configure security settings for your document portal.
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
                        parseInt(e.target.value)
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
                        parseInt(e.target.value)
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

        {/* Azure Integration Settings */}
        <TabsContent value='azure'>
          <Card>
            <CardHeader>
              <CardTitle>Azure AD Integration</CardTitle>
              <CardDescription>
                Azure AD integration status and settings.
              </CardDescription>
            </CardHeader>

            <CardContent className='space-y-4'>
              <div className='rounded-md bg-blue-50 p-4'>
                <p className='text-sm text-blue-800'>
                  Azure AD integration is configured through infrastructure code
                  (Terraform). To make changes to your Azure AD configuration,
                  please update your Terraform code and apply the changes.
                </p>
              </div>

              <div className='grid gap-2'>
                <Label className='text-muted-foreground'>
                  Connection Status
                </Label>
                <div className='flex items-center text-green-600'>
                  <svg
                    viewBox='0 0 10 10'
                    className='h-2.5 w-2.5 fill-current mr-2'
                  >
                    <circle cx='5' cy='5' r='5' />
                  </svg>
                  Connected to Azure AD
                </div>
              </div>

              <div className='grid gap-2'>
                <Label className='text-muted-foreground'>Tenant ID</Label>
                <div className='text-sm font-mono bg-muted p-2 rounded-md'>
                  {process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID ??
                    '00000000-0000-0000-0000-000000000000'}
                </div>
              </div>

              <div className='grid gap-2'>
                <Label className='text-muted-foreground'>Application ID</Label>
                <div className='text-sm font-mono bg-muted p-2 rounded-md'>
                  {process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID ??
                    '00000000-0000-0000-0000-000000000000'}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
