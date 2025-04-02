// src/app/documents/view/[name]/pdf-document-viewer.tsx
'use client'

import { Viewer, Worker } from '@react-pdf-viewer/core'
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'

import '@react-pdf-viewer/core/lib/styles/index.css'
import '@react-pdf-viewer/default-layout/lib/styles/index.css'
import '@react-pdf-viewer/zoom/lib/styles/index.css'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { VersionSelector } from '@/components/version-selector'
import { VersionUploadModal } from '@/components/version-upload-modal'
import { parseFileName } from '@/lib/version-manager'

interface PDFDocumentViewerProps {
  readonly fileName: string
}

export function PDFDocumentViewer({ fileName }: PDFDocumentViewerProps) {
  const router = useRouter()
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentVersion, setCurrentVersion] = useState<number>(1)
  const [totalVersions, setTotalVersions] = useState<number>(1)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [currentFileName, setCurrentFileName] = useState(fileName)
  const viewerContainerRef = useRef<HTMLDivElement>(null)

  // Extract original file name for display
  const { baseName, extension } = parseFileName(fileName)
  const displayName = `${baseName}${extension}`

  // Initialize the default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin()

  // Add custom CSS for better mobile experience
  useEffect(() => {
    // Add custom CSS for mobile optimization
    const style = document.createElement('style')
    style.textContent = `
      /* Larger touch targets for toolbar buttons on mobile */
      @media (max-width: 768px) {
        .rpv-core__minimal-button {
          padding: 8px !important;
          margin: 2px !important;
        }
        
        /* Increase size of page navigation buttons */
        .rpv-core__page-navigation-button {
          min-width: 40px !important;
          height: 40px !important;
        }
        
        /* Make the page input wider */
        .rpv-core__page-navigation-current-page-input {
          width: 3rem !important;
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Fetch PDF data
  const fetchPdf = useCallback(async (fileNameToFetch: string) => {
    setIsLoading(true)
    try {
      // First get the SAS URL through our API
      const response = await fetch(
        `/api/documents/download?name=${encodeURIComponent(fileNameToFetch)}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch PDF URL')
      }

      const { url } = await response.json()

      // Use a server proxy to fetch the PDF to avoid CORS issues
      const proxyResponse = await fetch(
        `/api/documents/proxy?url=${encodeURIComponent(url)}`
      )

      if (!proxyResponse.ok) {
        throw new Error('Failed to fetch PDF from proxy')
      }

      const arrayBuffer = await proxyResponse.arrayBuffer()
      setPdfData(new Uint8Array(arrayBuffer))
    } catch (err) {
      console.error('Error fetching PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch document versions to get metadata
  const fetchVersionInfo = useCallback(async () => {
    try {
      const { baseName } = parseFileName(fileName)
      if (!baseName) return

      const response = await fetch(
        `/api/documents/versions?baseName=${encodeURIComponent(baseName)}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch version information')
      }

      const data = await response.json()

      // Set total versions count
      setTotalVersions(data.totalVersions || 1)

      // Find the current version number
      const versionInfo = data.versions.find(
        (v: { fileName: string; versionNumber: number }) =>
          v.fileName === fileName
      )
      if (versionInfo) {
        setCurrentVersion(versionInfo.versionNumber)
      }
    } catch (err) {
      console.error('Error fetching version info:', err)
    }
  }, [fileName])

  // Load initial data
  useEffect(() => {
    fetchPdf(fileName)
    fetchVersionInfo()
    setCurrentFileName(fileName)
  }, [fileName, fetchVersionInfo, fetchPdf])

  // Handle version change
  const handleVersionChange = async (versionFileName: string) => {
    if (versionFileName !== currentFileName) {
      setCurrentFileName(versionFileName)
      fetchPdf(versionFileName)

      window.history.replaceState(
        {},
        '',
        `/documents/view/${encodeURIComponent(versionFileName)}`
      )

      // Update the current version number
      try {
        const { baseName } = parseFileName(versionFileName)
        if (!baseName) return

        const response = await fetch(
          `/api/documents/versions?baseName=${encodeURIComponent(baseName)}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch version information')
        }

        const data = await response.json()

        // Find the current version number for the selected file
        const versionInfo = data.versions.find(
          (v: any) => v.fileName === versionFileName
        )
        if (versionInfo) {
          setCurrentVersion(versionInfo.versionNumber)
        }
      } catch (err) {
        console.error('Error updating version info:', err)
      }
    }
  }

  // Handle new version upload
  const handleVersionUploaded = () => {
    // Refresh version information
    fetchVersionInfo()
  }

  // Extract rendering of PDF content to a separate function
  const renderPdfContent = () => {
    if (isLoading) {
      return <div className='flex justify-center p-4'>Loading...</div>
    }

    if (pdfData) {
      return (
        <div
          ref={viewerContainerRef}
          className='h-[500px] md:h-[750px] overflow-hidden rounded-md'
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          <Worker workerUrl='https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'>
            <Viewer fileUrl={pdfData} plugins={[defaultLayoutPluginInstance]} />
          </Worker>
        </div>
      )
    }

    return <div className='flex justify-center p-4'>No PDF data available</div>
  }

  if (error) {
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

  return (
    <div className='container mx-auto py-4'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            {/* Make the back button larger on mobile */}
            <Button
              variant='ghost'
              onClick={() => router.back()}
              className='h-10 w-10 p-0 sm:h-9 sm:w-auto sm:px-4'
            >
              <ArrowLeft className='h-5 w-5 sm:h-4 sm:w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Back</span>
            </Button>
            <h1 className='text-xl sm:text-2xl font-bold truncate max-w-[200px] sm:max-w-none'>
              {displayName}
            </h1>
          </div>

          {/* Version selector */}
          <VersionSelector
            fileName={currentFileName}
            currentVersion={currentVersion}
            totalVersions={totalVersions}
            onVersionChange={handleVersionChange}
            onUploadNewVersion={() => setShowUploadModal(true)}
          />
        </div>

        <Card className='p-2 sm:p-6'>
          {renderPdfContent()}

          {/* Add instruction for mobile users */}
          <div className='md:hidden text-center text-sm text-muted-foreground mt-4'>
            Use toolbar to zoom • Pinch to zoom in/out • Double-tap to reset
            zoom
          </div>
        </Card>
      </div>

      {/* Version upload modal */}
      {showUploadModal && (
        <VersionUploadModal
          originalFileName={displayName}
          onClose={() => setShowUploadModal(false)}
          onVersionUploaded={handleVersionUploaded}
        />
      )}
    </div>
  )
}
