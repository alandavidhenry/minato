// src/app/page.tsx
import { Camera, FolderTree, Star } from 'lucide-react'
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
                <FolderTree className='h-6 w-6 text-blue-500' />
                <CardTitle>Document Library</CardTitle>
              </div>
              <CardDescription>
                Access and organize your documents in folders
              </CardDescription>
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

        <Card className='opacity-60 cursor-not-allowed'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Star className='h-6 w-6' />
              <CardTitle>Future Feature 1</CardTitle>
            </div>
            <CardDescription>Coming soon</CardDescription>
          </CardHeader>
        </Card>

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
