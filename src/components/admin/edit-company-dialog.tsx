'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'

interface Company {
  id: string
  name: string
}

interface EditCompanyDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly company: Company | null
  readonly onCompanySaved: () => void
}

export function EditCompanyDialog({
  open,
  onOpenChange,
  company,
  onCompanySaved
}: EditCompanyDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (company) {
      setName(company.name)
    }
  }, [company])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Company name is required',
        variant: 'destructive'
      })
      return
    }

    if (!company) return

    setIsLoading(true)

    try {
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update company')
      }

      onCompanySaved()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update company',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update the company details.</DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='edit-company-name'>Company Name</Label>
              <Input
                id='edit-company-name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Acme Farms Ltd'
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
