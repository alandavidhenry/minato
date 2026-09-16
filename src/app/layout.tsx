// src/app/layout.tsx
import { Inter, Source_Code_Pro } from 'next/font/google'

import { AppShell } from '@/components/app-shell'
import { BreadcrumbProvider } from '@/components/providers/breadcrumb-provider'
import { RBACProvider } from '@/components/providers/rbac-provider'
import { AuthProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'

import type { Metadata } from 'next'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source-code-pro'
})

export const metadata: Metadata = {
  title: 'Minato',
  description: "Your organization's document management and compliance portal"
}

/*
  Applies the stored theme class before first paint. Without this the provider
  would only resolve the theme in an effect, flashing the light palette on every
  load now that dark is the default.
*/
const themeScript = `
try {
  var t = localStorage.getItem('theme') || 'dark'
  if (t === 'system') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.classList.add(t === 'light' ? 'light' : 'dark')
} catch (e) {
  document.documentElement.classList.add('dark')
}
`.trim()

export default function RootLayout({
  children
}: {
  readonly children: React.ReactNode
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <meta name='color-scheme' content='dark light' />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${sourceCodePro.variable} font-sans`}>
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
