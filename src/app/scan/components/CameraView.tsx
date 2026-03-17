'use client'

import { Camera } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CameraViewProps {
  readonly isActive: boolean
  readonly onCapture: () => void
  readonly videoRef: React.RefObject<HTMLVideoElement | null>
}

export function CameraView({ isActive, onCapture, videoRef }: CameraViewProps) {
  if (!isActive) {
    return null
  }

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className='w-full h-auto'
          style={{ maxHeight: '500px' }}
        >
          <track
            kind='captions'
            src='/empty-captions.vtt'
            label='English'
            default
          />
          Your browser does not support the video element.
        </video>
      </CardContent>
      <div className='p-4 flex justify-center'>
        <Button onClick={onCapture} disabled={!isActive} className='gap-2'>
          <Camera className='h-4 w-4' />
          Capture Image
        </Button>
      </div>
    </Card>
  )
}
