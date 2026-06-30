// src/app/page.tsx
import { Camera, FileText, Star, Users } from 'lucide-react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { authOptions } from '@/lib/auth'
import { CUSTOMER_ROLES, UserRole } from '@/types/rbac'

export default async function Home() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []
  const isCustomer = roles.some((r) => CUSTOMER_ROLES.includes(r))
  const isCustomerAdmin = roles.includes(UserRole.CUSTOMER_ADMIN)

  const docsHref = isCustomer ? '/customer/documents' : '/documents'
  const docsTitle = isCustomer ? 'My Documents' : 'Documents'
  const docsDescription = isCustomer
    ? 'View and complete your assigned documents'
    : 'Access all your documents'

  return (
    <div className='grid gap-4'>
      <h1 className='text-3xl font-bold'>Minato</h1>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Link href={docsHref}>
          <Card className='hover:bg-accent transition-colors cursor-pointer'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <FileText className='h-6 w-6' />
                <CardTitle>{docsTitle}</CardTitle>
              </div>
              <CardDescription>{docsDescription}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href='/scan'>
          <Card className='hover:bg-accent transition-colors cursor-pointer'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Camera className='h-6 w-6' />
                <CardTitle>Scan Documents</CardTitle>
              </div>
              <CardDescription>Convert images to documents</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        {isCustomerAdmin && (
          <Link href='/customer/admin/completions'>
            <Card className='hover:bg-accent transition-colors cursor-pointer'>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Users className='h-6 w-6' />
                  <CardTitle>Team Compliance</CardTitle>
                </div>
                <CardDescription>
                  View your team&apos;s completion status
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {!isCustomerAdmin && (
          <Card className='opacity-60 cursor-not-allowed'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Star className='h-6 w-6' />
                <CardTitle>Future Feature 1</CardTitle>
              </div>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className='opacity-60 cursor-not-allowed'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Star className='h-6 w-6' />
              <CardTitle>Future Feature 2</CardTitle>
            </div>
            <CardDescription>Coming soon</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
