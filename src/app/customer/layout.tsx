// src/app/customer/layout.tsx
'use client'

import { Files, FileText } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { CustomerPageGuard } from '@/components/auth/permission-guard'

export default function CustomerLayout({
  children
}: {
  readonly children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    {
      name: 'My Documents',
      href: '/customer/documents',
      icon: <FileText className='h-5 w-5' />
    },
    {
      name: 'My Files',
      href: '/customer/files',
      icon: <Files className='h-5 w-5' />
    }
  ]

  return (
    <CustomerPageGuard>
      <div className='flex flex-col md:flex-row'>
        {/* Sidebar */}
        <aside className='w-full md:w-64 bg-muted p-4 md:min-h-[calc(100vh-4rem)]'>
          <h2 className='text-xl font-bold mb-6'>Customer Portal</h2>
          <nav className='space-y-1'>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className='flex-1 p-4'>{children}</main>
      </div>
    </CustomerPageGuard>
  )
}
