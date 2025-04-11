'use client'

import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { useRef } from 'react'

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'

import { Card } from '@/components/ui/card'

interface PDFRendererProps {
  readonly pdfData: Uint8Array | null
  readonly isLoading: boolean
}

export function PDFRenderer({ pdfData, isLoading }: PDFRendererProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null)

  // Initialize the default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  // Render loading state
  if (isLoading) {
    return <div className='flex justify-center p-4'>Loading...</div>
  }

  // Render PDF content
  if (pdfData) {
    return (
      <Card className='p-2 sm:p-6'>
        <div
          ref={viewerContainerRef}
          className='h-[500px] md:h-[750px] overflow-hidden rounded-md'
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'>
            <Viewer fileUrl={pdfData} plugins={[defaultLayoutPluginInstance]} />
          </Worker>
        </div>

        {/* Add instruction for mobile users */}
        <div className='md:hidden text-center text-sm text-muted-foreground mt-4'>
          Use toolbar to zoom • Pinch to zoom in/out • Double-tap to reset zoom
        </div>
      </Card>
    )
  }

  return <div className='flex justify-center p-4'>No PDF data available</div>
}
