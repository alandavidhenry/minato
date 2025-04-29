'use client'

import { ArrowUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

interface UpLevelButtonProps {
  readonly currentPath: string
}

export function UpLevelButton({ currentPath }: UpLevelButtonProps) {
  const router = useRouter()

  if (!currentPath) {
    return null
  }

  const handleGoUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    const url = parentPath
      ? `/documents?path=${encodeURIComponent(parentPath)}`
      : '/documents'

    router.push(url)
  }

  return (
    <Button variant='outline' size='sm' onClick={handleGoUp} className='gap-1'>
      <ArrowUp className='h-4 w-4' />
      <span>Up a level</span>
    </Button>
  )
}
