import { ScanForm } from './scan-form'

export default function ScanPage() {
  return (
    <div className='grid gap-4'>
      <h1 className='text-3xl font-bold'>Scan Documents</h1>
      <p className='text-muted-foreground'>
        Convert images to documents by uploading a file or taking a photo with
        your camera.
      </p>
      <ScanForm />
    </div>
  )
}
