// src/app/unauthorized/page.tsx
'use client'

import { ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export default function UnauthorizedPage() {
  const router = useRouter()

  return (
    <div className='flex flex-col items-center justify-center h-[70vh] px-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='flex flex-col items-center'>
          <ShieldAlert className='h-16 w-16 text-destructive mb-2' />
          <CardTitle className='text-2xl text-center'>Access Denied</CardTitle>
        </CardHeader>
        <CardContent className='text-center'>
          <p className='mb-4'>
            You don&apost have permission to access this page. Please contact an
            administrator if you believe this is an error.
          </p>
        </CardContent>
        <CardFooter className='flex justify-center'>
          <Button onClick={() => router.push('/')}>Return to Home</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
