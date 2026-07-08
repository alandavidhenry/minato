// src/app/layout.tsx
import { Fira_Code, Poppins, PT_Serif } from 'next/font/google'

import { AppShell } from '@/components/app-shell'
import { BreadcrumbProvider } from '@/components/providers/breadcrumb-provider'
import { RBACProvider } from '@/components/providers/rbac-provider'
import { AuthProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'

import type { Metadata } from 'next'

import './globals.css'

const fontSans = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans'
})

const fontSerif = PT_Serif({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif'
})

const fontMono = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono'
})

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
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
      >
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
