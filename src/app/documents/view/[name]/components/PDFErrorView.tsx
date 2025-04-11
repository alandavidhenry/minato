'use client'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PDFErrorViewProps {
  readonly error: string | null
}

export function PDFErrorView({ error }: PDFErrorViewProps) {
  if (!error) return null

  return (
    <div className='container mx-auto py-4'>
      <Card className='p-6'>
        <div className='flex flex-col gap-4 items-center'>
          <p className='text-red-500'>{error}</p>
          <Button
            onClick={() => {
              window.location.href = '/documents'
            }}
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Documents
          </Button>
        </div>
      </Card>
    </div>
  )
}
