// src/app/layout.tsx
import { Inter } from 'next/font/google'

import type { Metadata } from 'next'

import { NavBar } from '@/components/nav-bar'
import { RBACProvider } from '@/components/providers/rbac-provider'
import { AuthProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Document Portal',
  description: "Your organization's document portal"
}

export default function RootLayout({
  children
}: {
  readonly children: React.ReactNode
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <RBACProvider>
              <div className='min-h-screen bg-background flex flex-col'>
                <NavBar />
                <main className='flex-1'>
                  <div className='container mx-auto py-4'>{children}</div>
                </main>
              </div>
              <Toaster />
            </RBACProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
