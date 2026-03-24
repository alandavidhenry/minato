'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState, useRef, useCallback } from 'react'

import { toast } from '@/components/ui/use-toast'

import { CameraView } from './components/CameraView'
import { FileDropzone } from './components/FileDropzone'
import { FilePreview } from './components/FilePreview'
import { UploadControls } from './components/UploadControls'


export function ScanForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isDragging, setIsDragging] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  // Check if the device has a camera
  const hasCamera =
    typeof navigator !== 'undefined' && 'mediaDevices' in navigator

  // Function to stop the camera
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCameraActive(false)
  }, [])

  // Function to trigger file input click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Function to handle file selection
  const handleFileSelection = useCallback(
    (file: File) => {
      // Create a preview URL
      const imageUrl = URL.createObjectURL(file)
      setSelectedImage(imageUrl)
      setSelectedFile(file)

      // Stop camera if it's active
      stopCamera()
    },
    [stopCamera]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to upload documents',
          variant: 'destructive'
        })
        return
      }

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Only accept image files
      if (!files[0].type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive'
        })
        return
      }

      handleFileSelection(files[0])
    },
    [session, handleFileSelection]
  )

  // Function to activate the camera
  const handleCameraClick = useCallback(async () => {
    if (isCameraActive) {
      stopCamera()
      return
    }

    try {
      setIsLoading(true)

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      // Store the stream to stop it later
      mediaStreamRef.current = stream

      // Set video source to camera stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      toast({
        title: 'Camera error',
        description: 'Could not access your camera. Please check permissions.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [isCameraActive, stopCamera])

  // Function to capture image from camera
  const captureImage = useCallback(() => {
    if (!videoRef.current || !isCameraActive) return

    try {
      // Create a canvas element
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight

      // Draw the current video frame to the canvas
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

        // Convert canvas to data URL
        const imageUrl = canvas.toDataURL('image/jpeg')
        setSelectedImage(imageUrl)

        // Convert data URL to Blob and then to File object
        fetch(imageUrl)
          .then((res) => res.blob())
          .then((blob) => {
            const fileName = `camera_capture_${Date.now()}.jpg`
            const file = new File([blob], fileName, { type: 'image/jpeg' })
            setSelectedFile(file)
          })
      }

      // Stop the camera after capturing
      stopCamera()
    } catch (error) {
      console.error('Error capturing image:', error)
      toast({
        title: 'Capture error',
        description: 'Could not capture image from camera.',
        variant: 'destructive'
      })
    }
  }, [isCameraActive, stopCamera])

  // Function to upload image to blob storage
  const uploadImage = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: 'No image selected',
        description: 'Please select or capture an image first.',
        variant: 'destructive'
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', selectedFile)

      // Use XMLHttpRequest for progress monitoring
      const xhr = new XMLHttpRequest()

      // Set up progress monitoring
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      // Create a promise to handle the response
      const uploadPromise = new Promise<{ fileName: string; success: boolean }>(
        (resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText)
                resolve(response)
              } catch {
                reject(new Error('Invalid response format'))
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`))
            }
          }
          xhr.onerror = () => reject(new Error('Network error during upload'))
        }
      )

      // Configure and send the request
      xhr.open('POST', '/api/scan/upload', true)
      xhr.send(formData)

      // Wait for the upload to complete
      const response = await uploadPromise

      toast({
        title: 'Upload successful',
        description: `Your image "${response.fileName}" has been uploaded successfully.`,
        duration: 3000
      })

      // Clear the selected image and file
      setSelectedImage(null)
      setSelectedFile(null)

      // Navigate to documents page or handle as needed
      router.push('/documents')
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [selectedFile, router])

  // Function to clear selected image/file
  const clearSelectedFile = useCallback(() => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage)
    }
    setSelectedImage(null)
    setSelectedFile(null)
  }, [selectedImage])

  return (
    <div className='space-y-6'>
      <UploadControls
        onUploadClick={handleUploadClick}
        onCameraClick={handleCameraClick}
        onUploadSubmit={uploadImage}
        hasCamera={hasCamera}
        isCameraActive={isCameraActive}
        isUploading={isUploading}
        isLoading={isLoading}
        selectedFile={selectedFile}
      />

      {/* Camera view */}
      <CameraView
        isActive={isCameraActive}
        onCapture={captureImage}
        videoRef={videoRef}
      />

      {/* Selected image preview */}
      {selectedImage && !isCameraActive && (
        <FilePreview
          selectedImage={selectedImage}
          selectedFile={selectedFile}
          onRemove={clearSelectedFile}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}

      {/* File dropzone when no image is selected */}
      {!selectedImage && !isCameraActive && (
        <FileDropzone
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileSelect={handleFileSelection}
          isUploading={isUploading}
        />
      )}
    </div>
  )
}
