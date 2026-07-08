'use client'

import { Palette } from 'lucide-react'

import { useTheme } from '@/components/providers/theme-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { COLOR_THEMES } from '@/lib/color-themes'

export default function SettingsPage() {
  const { colorTheme, setColorTheme } = useTheme()

  return (
    <div className='max-w-2xl mx-auto py-8 px-4 space-y-6'>
      <h1 className='text-3xl font-bold'>Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Palette className='h-5 w-5' />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose the color theme used across the app on this device.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='colorTheme'>Theme</Label>
            <Select value={colorTheme} onValueChange={setColorTheme}>
              <SelectTrigger id='colorTheme' className='w-full sm:w-64'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_THEMES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
