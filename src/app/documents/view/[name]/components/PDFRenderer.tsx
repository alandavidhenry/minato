'use client'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFRendererProps {
  readonly pdfData: Uint8Array | null
  readonly isLoading: boolean
  readonly fileName?: string
}

export function PDFRenderer({
  pdfData,
  isLoading,
  fileName = 'document.pdf'
}: PDFRendererProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!pdfData) {
      setFileUrl(null)
      return
    }
    const blob = new Blob([pdfData as Uint8Array<ArrayBuffer>], {
      type: 'application/pdf'
    })
    const url = URL.createObjectURL(blob)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pdfData])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      setCurrentPage(1)
    },
    []
  )

  const handleDownload = useCallback(() => {
    if (!fileUrl) return
    const a = document.createElement('a')
    a.href = fileUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [fileUrl, fileName])

  const handlePrint = useCallback(() => {
    if (!fileUrl) return
    const iframe = document.createElement('iframe')
    // Off-screen but fully dimensioned so the PDF plugin loads correctly
    iframe.style.cssText =
      'position:fixed;top:0;left:100%;width:100%;height:100%;border:none;'
    iframe.src = fileUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 60000)
    }
  }, [fileUrl])

  if (isLoading || (pdfData && !fileUrl)) {
    return <div className='flex justify-center p-4'>Loading...</div>
  }

  if (fileUrl) {
    return (
      <Card className='p-2 sm:p-6'>
        <div className='flex items-center justify-between mb-3 gap-2 flex-wrap'>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <span className='text-sm px-2 min-w-[5rem] text-center'>
              {currentPage} / {numPages}
            </span>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              disabled={scale <= 0.5}
            >
              <ZoomOut className='h-4 w-4' />
            </Button>
            <span className='text-sm px-2 min-w-[3.5rem] text-center'>
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setScale((s) => Math.min(3.0, s + 0.25))}
              disabled={scale >= 3.0}
            >
              <ZoomIn className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='icon' onClick={handlePrint}>
              <Printer className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='icon' onClick={handleDownload}>
              <Download className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div
          className='overflow-auto rounded-md flex justify-center'
          style={{ maxHeight: 'calc(100vh - 250px)' }}
        >
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className='flex justify-center p-4'>Loading PDF...</div>
            }
            error={
              <div className='flex justify-center p-4 text-destructive'>
                Failed to load PDF.
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer
              renderAnnotationLayer
              className='shadow-md'
            />
          </Document>
        </div>

        <div className='md:hidden text-center text-sm text-muted-foreground mt-4'>
          Use toolbar to zoom • Pinch to zoom in/out • Double-tap to reset zoom
        </div>
      </Card>
    )
  }

  return <div className='flex justify-center p-4'>No PDF data available</div>
}
