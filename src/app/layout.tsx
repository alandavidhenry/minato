// src/app/layout.tsx
import { Inter } from 'next/font/google'

import { AppShell } from '@/components/app-shell'
import { BreadcrumbProvider } from '@/components/providers/breadcrumb-provider'
import { RBACProvider } from '@/components/providers/rbac-provider'
import { AuthProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'

import type { Metadata } from 'next'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Minato',
  description: "Your organization's document management and compliance portal"
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
              <BreadcrumbProvider>
                <AppShell>{children}</AppShell>
              </BreadcrumbProvider>
              <Toaster />
            </RBACProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
