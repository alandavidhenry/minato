'use client'

import { useEffect, useState, useCallback } from 'react'

import { PDFErrorView } from './components/PDFErrorView'
import { PDFRenderer } from './components/PDFRenderer'
import { PDFToolbar } from './components/PDFToolbar'
import { fetchPdf, fetchVersionInfo } from './services/pdf-service'

import { VersionUploadModal } from '@/components/version-upload-modal'
import { parseFileName } from '@/lib/version-manager'

interface PDFDocumentViewerProps {
  readonly fileName: string
}

export function PDFDocumentViewer({ fileName }: PDFDocumentViewerProps) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentVersion, setCurrentVersion] = useState<number>(1)
  const [totalVersions, setTotalVersions] = useState<number>(1)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [currentFileName, setCurrentFileName] = useState(fileName)

  // Extract original file name for display
  const { baseName, extension } = parseFileName(fileName)
  const displayName = `${baseName}${extension}`

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
  const loadPdf = useCallback(async (fileNameToFetch: string) => {
    setIsLoading(true)
    try {
      const data = await fetchPdf(fileNameToFetch)
      setPdfData(data)
    } catch (err) {
      console.error('Error fetching PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch document versions to get metadata
  const loadVersionInfo = useCallback(async () => {
    try {
      const { baseName } = parseFileName(fileName)
      if (!baseName) return

      const data = await fetchVersionInfo(baseName)

      // Set total versions count
      setTotalVersions(data.totalVersions || 1)

      // Find the current version number
      const versionInfo = data.versions.find((v) => v.fileName === fileName)
      if (versionInfo) {
        setCurrentVersion(versionInfo.versionNumber)
      }
    } catch (err) {
      console.error('Error fetching version info:', err)
    }
  }, [fileName])

  // Load initial data
  useEffect(() => {
    loadPdf(fileName)
    loadVersionInfo()
    setCurrentFileName(fileName)
  }, [fileName, loadVersionInfo, loadPdf])

  // Handle version change
  const handleVersionChange = async (versionFileName: string) => {
    if (versionFileName !== currentFileName) {
      setCurrentFileName(versionFileName)
      loadPdf(versionFileName)

      window.history.replaceState(
        {},
        '',
        `/documents/view/${encodeURIComponent(versionFileName)}`
      )

      // Update the current version number
      try {
        const { baseName } = parseFileName(versionFileName)
        if (!baseName) return

        const data = await fetchVersionInfo(baseName)

        // Find the current version number for the selected file
        const versionInfo = data.versions.find(
          (v) => v.fileName === versionFileName
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
    loadVersionInfo()
  }

  // Show error if there's a problem loading the PDF
  if (error) {
    return <PDFErrorView error={error} />
  }

  return (
    <div className='container mx-auto py-4'>
      <div className='flex flex-col gap-4'>
        <PDFToolbar
          displayName={displayName}
          currentFileName={currentFileName}
          currentVersion={currentVersion}
          totalVersions={totalVersions}
          onVersionChange={handleVersionChange}
          onNewVersion={() => setShowUploadModal(true)}
        />

        <PDFRenderer pdfData={pdfData} isLoading={isLoading} />
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
