import { PageHeader } from '@/components/page-header'

import { ScanForm } from './scan-form'

export default function ScanPage() {
  return (
    <div className='grid gap-4'>
      <PageHeader
        title='Scan Documents'
        description='Convert images to documents by uploading a file or taking a photo with your camera.'
      />
      <ScanForm />
    </div>
  )
}
