'use client'

import { useParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'

interface Company {
  id: string
  name: string
}

interface Assignment {
  id: string
  dueDate: string | null
  template: {
    id: string
    title: string
    description: string | null
  }
}

interface Worker {
  id: string
  displayName: string
  jobRole: string | null
  assignments: Assignment[]
}

export default function KioskPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const { status } = useSession()
  const [company, setCompany] = useState<Company | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/signoff/${companyId}`)
      .then((r) => r.json())
      .then((data) => {
        setCompany(data.company ?? null)
        setWorkers(data.workers ?? [])
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Could not load sign-off page.',
          variant: 'destructive'
        })
      })
      .finally(() => setIsLoading(false))
  }, [companyId])

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) ?? null

  if (status === 'loading' || isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <p className='text-muted-foreground'>Loading...</p>
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen gap-4 text-center p-6'>
        <h1 className='text-2xl font-bold'>Access denied</h1>
        <p className='text-muted-foreground max-w-sm'>
          This kiosk is for workers without a Minato platform account. Please
          sign out before using the kiosk sign-off page.
        </p>
        <Button
          variant='outline'
          onClick={() => signOut({ callbackUrl: globalThis.location.href })}
        >
          Sign out
        </Button>
      </div>
    )
  }

  if (!company) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <p className='text-muted-foreground'>Sign-off page not found.</p>
      </div>
    )
  }

  return (
    <div className='max-w-2xl mx-auto space-y-8 p-6 pt-12'>
      <div>
        <p className='text-sm text-muted-foreground uppercase tracking-wide'>
          Document Sign-off
        </p>
        <h1 className='text-3xl font-bold mt-1'>{company.name}</h1>
        {workers.length > 0 && (
          <p className='text-muted-foreground mt-2'>
            Select your name below to see your assigned documents.
          </p>
        )}
      </div>

      {workers.length === 0 ? (
        <p className='text-muted-foreground'>
          No workers are registered for kiosk sign-off at this company.
        </p>
      ) : (
        <>
          <div className='space-y-2'>
            <label
              htmlFor='worker-select'
              className='text-sm font-medium leading-none'
            >
              Who are you?
            </label>
            <Select
              value={selectedWorkerId}
              onValueChange={setSelectedWorkerId}
            >
              <SelectTrigger id='worker-select' className='w-full'>
                <SelectValue placeholder='Select your name...' />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.displayName}
                    {w.jobRole ? ` — ${w.jobRole}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedWorker && (
            <div className='space-y-4'>
              <h2 className='text-xl font-semibold'>
                Documents for {selectedWorker.displayName}
              </h2>

              {selectedWorker.assignments.length === 0 ? (
                <p className='text-muted-foreground'>
                  No documents to sign off — all up to date.
                </p>
              ) : (
                <div className='space-y-3'>
                  {selectedWorker.assignments.map((a) => (
                    <div
                      key={a.id}
                      className='flex items-center justify-between rounded-md border p-4'
                    >
                      <div className='space-y-1'>
                        <p className='font-medium'>{a.template.title}</p>
                        {a.template.description && (
                          <p className='text-sm text-muted-foreground'>
                            {a.template.description}
                          </p>
                        )}
                        {a.dueDate && (
                          <Badge
                            variant={
                              new Date(a.dueDate) < new Date()
                                ? 'destructive'
                                : 'secondary'
                            }
                            className='text-xs'
                          >
                            {new Date(a.dueDate) < new Date()
                              ? 'Overdue'
                              : 'Due'}{' '}
                            {new Date(a.dueDate).toLocaleDateString('en-GB')}
                          </Badge>
                        )}
                      </div>
                      <Button asChild size='sm'>
                        <a
                          href={`/signoff/${companyId}/${a.id}/complete?workerId=${selectedWorker.id}`}
                        >
                          Sign off
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
