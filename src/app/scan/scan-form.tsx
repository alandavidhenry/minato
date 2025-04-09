// src/app/scan/scan-form.tsx
'use client'

import { Camera, Upload, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/use-toast'

export function ScanForm() {
  const router = useRouter()
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

  // Function to trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Function to handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Only accept image files
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive'
      })
      return
    }

    // Create a preview URL
    const imageUrl = URL.createObjectURL(file)
    setSelectedImage(imageUrl)
    setSelectedFile(file)

    // Reset the file input for future uploads
    event.target.value = ''

    // Stop camera if it's active
    stopCamera()
  }

  // Function to activate the camera
  const handleCameraClick = async () => {
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
  }

  // Function to stop the camera
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCameraActive(false)
  }

  // Function to capture image from camera
  const captureImage = () => {
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
  }

  // Function to upload image to blob storage
  const uploadImage = async () => {
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
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap gap-4'>
        <Button
          onClick={handleUploadClick}
          disabled={isLoading || isCameraActive || isUploading}
          className='gap-2'
        >
          <Upload className='h-4 w-4' />
          Import Image
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={handleFileChange}
            disabled={isLoading || isCameraActive || isUploading}
          />
        </Button>

        {hasCamera && (
          <Button
            onClick={handleCameraClick}
            disabled={isLoading || isUploading}
            variant={isCameraActive ? 'destructive' : 'default'}
            className='gap-2'
          >
            <Camera className='h-4 w-4' />
            {isCameraActive ? 'Stop Camera' : 'Use Camera'}
          </Button>
        )}

        {isCameraActive && (
          <Button
            onClick={captureImage}
            disabled={isUploading}
            className='gap-2'
          >
            <Camera className='h-4 w-4' />
            Capture Image
          </Button>
        )}
      </div>

      {/* Camera view with caption track for accessibility */}
      {isCameraActive && (
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
        </Card>
      )}

      {/* Selected image preview using Next.js Image component */}
      {selectedImage && !isCameraActive && (
        <Card className='overflow-hidden'>
          <CardContent className='p-0'>
            <div className='relative w-full' style={{ height: '500px' }}>
              <Image
                src={selectedImage}
                alt='Selected document'
                fill
                className='object-contain'
                sizes='(max-width: 768px) 100vw, 800px'
                priority
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder when no image is selected */}
      {!selectedImage && !isCameraActive && (
        <Card className='border-dashed'>
          <CardContent className='flex flex-col items-center justify-center p-6'>
            <p className='text-muted-foreground text-center py-8'>
              No image selected. Please import an image or use your camera.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className='space-y-2'>
          <Progress value={uploadProgress} className='h-2' />
          <p className='text-sm text-muted-foreground text-center'>
            {uploadProgress}% uploaded
          </p>
        </div>
      )}

      {/* Upload button */}
      {selectedImage && (
        <Button
          onClick={uploadImage}
          disabled={isUploading || !selectedFile}
          className='w-full md:w-auto gap-2'
        >
          {isUploading ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' />
              Uploading...
            </>
          ) : (
            <>
              <Upload className='h-4 w-4' />
              Upload Document
            </>
          )}
        </Button>
      )}
    </div>
  )
}
