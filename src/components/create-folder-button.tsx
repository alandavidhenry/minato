// src/components/create-folder-button.tsx
'use client'

import { FolderPlus } from 'lucide-react'
import { useState } from 'react'

import { CreateFolderModal } from '@/components/create-folder-modal'
import { Button } from '@/components/ui/button'

interface CreateFolderButtonProps {
  currentPath?: string
}

export function CreateFolderButton({
  currentPath = ''
}: CreateFolderButtonProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        variant='outline'
        className='gap-2'
      >
        <FolderPlus className='h-4 w-4' />
        New Folder
      </Button>

      <CreateFolderModal
        open={showModal}
        onOpenChange={setShowModal}
        currentPath={currentPath}
      />
    </>
  )
}
