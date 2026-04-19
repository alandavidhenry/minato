// src/components/share-modal.tsx
'use client'

import { Copy, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/components/ui/use-toast'

interface ShareModalProps {
  readonly fileName: string
  readonly onClose: () => void
  readonly onShareGenerated: (url: string) => void
  /** Override the default share URL generator. Receives expiration days, returns the share URL. */
  readonly getShareUrl?: (expirationDays: number) => Promise<string>
}

export function ShareModal({
  fileName,
  onClose,
  onShareGenerated,
  getShareUrl
}: ShareModalProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [expirationDays, setExpirationDays] = useState<number>(7)
  const [shortUrl, setShortUrl] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsLoading(true)

    try {
      // Use custom generator if provided, otherwise call the documents share API
      let shareUrl: string
      if (getShareUrl) {
        shareUrl = await getShareUrl(expirationDays)
      } else {
        const shareResponse = await fetch(
          `/api/documents/share?name=${encodeURIComponent(fileName)}&expirationDays=${expirationDays}`
        )

        if (!shareResponse.ok) {
          const errorData = await shareResponse.json()
          throw new Error(errorData.error || 'Share link generation failed')
        }

        shareUrl = (await shareResponse.json()).shareUrl
      }

      // Then shorten the URL
      const shortenResponse = await fetch('/api/shorturl/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: shareUrl,
          expirationDays
        })
      })

      if (!shortenResponse.ok) {
        throw new Error('URL shortening failed. Please try again.')
      }

      const { shortUrl } = await shortenResponse.json()
      setShortUrl(shortUrl)
      onShareGenerated(shortUrl)
    } catch (error) {
      console.error('Share error:', error)
      toast({
        title: 'Failed to generate share link',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shortUrl) return

    try {
      await navigator.clipboard.writeText(shortUrl)
      toast({
        title: 'Link copied to clipboard',
        description: 'The shareable link has been copied to your clipboard.',
        duration: 3000
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        title: 'Failed to copy link',
        description: 'Please try selecting and copying the link manually.',
        variant: 'destructive',
        duration: 3000
      })
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300) // Allow for fade-out animation
  }

  return (
    <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center'>
      <Card
        className={`w-full max-w-md transform transition-all duration-300 p-2 sm:p-4 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-xl'>
            Share &quot;{fileName}&quot;
          </CardTitle>
          <Button variant='ghost' size='icon' onClick={handleClose}>
            <X className='h-4 w-4' />
          </Button>
        </CardHeader>

        <CardContent>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Link expiration</Label>
              <RadioGroup
                defaultValue='7'
                value={expirationDays.toString()}
                onValueChange={(value) => setExpirationDays(parseInt(value))}
                className='flex flex-col space-y-1'
              >
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='1' id='r1' />
                  <Label htmlFor='r1'>1 day</Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='7' id='r2' />
                  <Label htmlFor='r2'>7 days</Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='30' id='r3' />
                  <Label htmlFor='r3'>30 days</Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='90' id='r4' />
                  <Label htmlFor='r4'>90 days</Label>
                </div>
              </RadioGroup>
            </div>

            {shortUrl && (
              <div className='mt-4 space-y-2'>
                <Label>Shortened URL</Label>
                <div className='flex items-center space-x-2'>
                  <div className='flex-1 rounded-md border bg-background p-2 text-sm'>
                    {shortUrl}
                  </div>
                  <Button size='icon' variant='outline' onClick={handleCopy}>
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className='flex justify-between'>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>

          {!shortUrl ? (
            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Link'}
            </Button>
          ) : (
            <Button onClick={handleCopy}>Copy Link</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
