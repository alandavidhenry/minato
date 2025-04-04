// src/app/auth/signin/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'

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

// Create a client component that uses useSearchParams
function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/documents'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else if (result?.ok) {
        window.location.href = callbackUrl
      }
    } catch {
      setError('An error occurred during sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='w-full max-w-md space-y-8'>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Document Portal</CardTitle>
          <CardDescription>
            Enter your email and password to sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignIn} className='space-y-4'>
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
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                placeholder='••••••••'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className='bg-destructive/10 p-3 rounded-md text-sm text-destructive'>
                {error}
              </div>
            )}
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className='flex-col gap-4'>
          <div className='relative w-full'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t border-gray-300' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>
                Or continue with
              </span>
            </div>
          </div>
          <Button
            variant='outline'
            onClick={() => signIn('azure-ad', { callbackUrl })}
            className='w-full'
          >
            Sign in with Microsoft
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// Add a loading fallback for the suspense boundary
function SignInLoading() {
  return (
    <div className='w-full max-w-md space-y-8'>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Document Portal</CardTitle>
          <CardDescription>Loading sign-in options...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='h-48 flex items-center justify-center'>
            <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Main page component with Suspense
export default function SignIn() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center'>
      <Suspense fallback={<SignInLoading />}>
        <SignInContent />
      </Suspense>
    </div>
  )
}
