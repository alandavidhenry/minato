// src/components/document-breadcrumb.tsx
'use client'

import { Folder, Home } from 'lucide-react'
import Link from 'next/link'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

interface DocumentBreadcrumbProps {
  readonly currentPath: string
}

export function DocumentBreadcrumb({ currentPath }: DocumentBreadcrumbProps) {
  // If no path, don't show breadcrumb
  if (!currentPath) {
    return null
  }

  // Split the path into segments
  const segments = currentPath.split('/').filter(Boolean)

  // Generate breadcrumb items with proper paths
  const breadcrumbItems = [
    { name: 'Root', path: '' }, // Root folder
    ...segments.map((segment, index) => {
      const path = segments.slice(0, index + 1).join('/')
      return { name: segment, path }
    })
  ]

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <BreadcrumbItem key={item.path}>
            <BreadcrumbItem key={item.path}>
              <Link
                href={
                  item.path
                    ? `/documents?path=${encodeURIComponent(item.path)}`
                    : '/documents'
                }
                className='flex items-center transition-colors hover:text-foreground'
              >
                {index === 0 ? (
                  <Home className='h-3 w-3 mr-1' />
                ) : (
                  <Folder className='h-3 w-3 mr-1' />
                )}
                {item.name}
              </Link>
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
