'use client'

import { useState } from 'react'

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

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('An error occurred. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <div className='w-full max-w-md space-y-8'>
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {submitted
                ? 'Check your email for a reset link'
                : 'Enter your email and we will send you a reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <p className='text-sm text-muted-foreground'>
                If an account exists for <strong>{email}</strong>, you will
                receive a password reset email shortly. The link expires in 1
                hour.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    type='email'
                    placeholder='name@example.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className='bg-destructive/10 p-3 rounded-md text-sm text-destructive'>
                    {error}
                  </div>
                )}
                <Button type='submit' className='w-full' disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
                <p className='text-center text-sm text-muted-foreground'>
                  <a
                    href='/auth/signin'
                    className='underline underline-offset-4 hover:text-primary'
                  >
                    Back to sign in
                  </a>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
