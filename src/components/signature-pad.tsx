'use client'

import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SIGNATURE_HEIGHT = 160

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  error?: boolean
}

export function SignaturePad({ onChange, disabled, error }: SignaturePadProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<SignatureCanvas>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry.contentRect.width)
      setWidth((prevWidth) => {
        // Changing the canvas element's width/height attributes wipes its
        // bitmap natively, so keep the already-captured signature in sync.
        if (prevWidth !== 0 && prevWidth !== nextWidth) {
          padRef.current?.clear()
          onChange(null)
        }
        return nextWidth
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnd() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      onChange(null)
      return
    }
    onChange(pad.getTrimmedCanvas().toDataURL('image/png'))
  }

  function handleClear() {
    padRef.current?.clear()
    onChange(null)
  }

  return (
    <div className='space-y-2'>
      <div
        ref={containerRef}
        className={cn(
          'rounded-md border bg-white',
          error ? 'border-destructive' : 'border-input',
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        {width > 0 && (
          <SignatureCanvas
            ref={padRef}
            penColor='black'
            onEnd={handleEnd}
            canvasProps={{
              width,
              height: SIGNATURE_HEIGHT,
              'aria-label': 'Signature',
              className: 'touch-none'
            }}
          />
        )}
      </div>
      <div className='flex items-center justify-between'>
        <p className='text-xs text-muted-foreground'>
          Sign using your mouse, stylus, or finger
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleClear}
          disabled={disabled}
        >
          Clear signature
        </Button>
      </div>
    </div>
  )
}
