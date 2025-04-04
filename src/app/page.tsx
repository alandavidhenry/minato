// src/app/page.tsx
import { FileText } from 'lucide-react'
import Link from 'next/link'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'

export default function Home() {
  return (
    <div className='grid gap-4'>
      <h1 className='text-3xl font-bold'>Document Portal</h1>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Link href='/documents'>
          <Card className='hover:bg-accent transition-colors cursor-pointer'>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <FileText className='h-6 w-6' />
                <CardTitle>Documents</CardTitle>
              </div>
              <CardDescription>Access all your documents</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
