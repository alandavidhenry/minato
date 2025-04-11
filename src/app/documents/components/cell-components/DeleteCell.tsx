'use client'

import { Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

import { DeleteConfirmationModal } from '@/components/delete-confirmation-modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

interface DeleteCellProps {
  readonly name: string
}

export function DeleteCell({ name }: DeleteCellProps) {
  const { data: session } = useSession()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDeleteClick = () => {
    if (!session || isDeleting) return
    setShowConfirmation(true)
  }

  const confirmDelete = async () => {
    if (!session || isDeleting) return

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/documents/delete?name=${encodeURIComponent(name)}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Delete failed')
      }

      toast({
        title: 'Document deleted',
        description: `${name} has been deleted successfully.`,
        duration: 3000
      })

      // Refresh the page to update the document list
      window.location.reload()
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete document',
        variant: 'destructive',
        duration: 3000
      })
    } finally {
      setIsDeleting(false)
      setShowConfirmation(false)
    }
  }

  return (
    <>
      <Button
        variant='ghost'
        size='icon'
        onClick={handleDeleteClick}
        disabled={!session || isDeleting}
        className='text-destructive hover:text-destructive'
        title='Delete'
      >
        <Trash2 className={isDeleting ? 'animate-pulse' : ''} />
      </Button>

      {showConfirmation && (
        <DeleteConfirmationModal
          fileNames={name}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmation(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  )
}
