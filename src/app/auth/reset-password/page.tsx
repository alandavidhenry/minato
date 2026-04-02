'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error ?? 'An error occurred. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <p className='text-sm text-destructive'>
            Invalid reset link. Please{' '}
            <a
              href='/auth/forgot-password'
              className='underline underline-offset-4 hover:text-primary'
            >
              request a new one
            </a>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>
          {success
            ? 'Password updated successfully'
            : 'Choose a new password for your account'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <p className='text-sm text-muted-foreground'>
            Your password has been reset.{' '}
            <a
              href='/auth/signin'
              className='underline underline-offset-4 hover:text-primary'
            >
              Sign in
            </a>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='password'>New password</Label>
              <Input
                id='password'
                type='password'
                placeholder='••••••••'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirm'>Confirm password</Label>
              <Input
                id='confirm'
                type='password'
                placeholder='••••••••'
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className='bg-destructive/10 p-3 rounded-md text-sm text-destructive'>
                {error}
              </div>
            )}
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Reset password'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPassword() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='w-full max-w-md space-y-8'>
        <Suspense fallback={<div />}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  )
}
