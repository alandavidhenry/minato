// src/components/create-folder-button.tsx
'use client'

import { FolderPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CreateFolderModal } from '@/components/create-folder-modal'
import { Button } from '@/components/ui/button'

interface CreateFolderButtonProps {
  readonly currentPath?: string
}

export function CreateFolderButton({
  currentPath = ''
}: CreateFolderButtonProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const handleFolderCreated = () => {
    // Refresh the page to show the new folder
    router.refresh()
  }

  return (
    <>
      <Button
        variant='outline'
        onClick={() => setShowModal(true)}
        className='gap-2'
      >
        <FolderPlus className='h-4 w-4' />
        New Folder
      </Button>

      <CreateFolderModal
        open={showModal}
        onOpenChange={setShowModal}
        onFolderCreated={handleFolderCreated}
        currentPath={currentPath}
      />
    </>
  )
}
