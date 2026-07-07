'use client'

import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { SidebarContent } from '@/components/app-sidebar'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { NotificationBell } from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'

// Routes that never get the authenticated app shell (public / kiosk pages).
const PUBLIC_PREFIXES = ['/auth', '/signoff', '/shared', '/s/']

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  )
}

const STORAGE_KEY = 'sidebar-collapsed'

function Footer() {
  return (
    <footer className='border-t py-4'>
      <div className='container mx-auto text-center text-sm text-muted-foreground'>
        <Link href='/privacy' className='hover:underline'>
          Privacy Policy
        </Link>
      </div>
    </footer>
  )
}

// Minimal chrome for public and signed-out pages (sign-in, kiosk, shared views).
function PublicChrome({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  return (
    <div className='flex min-h-screen flex-col bg-background'>
      <header className='flex h-16 items-center justify-between border-b px-4'>
        <Link href='/' className='text-xl font-bold'>
          Minato
        </Link>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          {session ? (
            <Button
              variant='outline'
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              Sign Out
            </Button>
          ) : (
            <Button onClick={() => signIn()}>Sign In</Button>
          )}
        </div>
      </header>
      <main className='flex-1'>
        <div className='container mx-auto py-4'>{children}</div>
      </main>
      <Footer />
    </div>
  )
}

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const { status } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore the persisted desktop collapse preference.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Show the app shell on non-public routes unless the user is signed out.
  // While the session is loading we keep the shell to avoid a public→app flash.
  const showAppChrome = !isPublicPath(pathname) && status !== 'unauthenticated'

  if (!showAppChrome) {
    return <PublicChrome>{children}</PublicChrome>
  }

  return (
    <div className='flex min-h-screen flex-col bg-background'>
      {/* Top bar */}
      <header className='sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4'>
        <Button
          variant='ghost'
          size='icon'
          className='md:hidden'
          onClick={() => setMobileOpen(true)}
          aria-label='Open menu'
        >
          <Menu className='h-5 w-5' />
        </Button>
        <Link href='/' className='text-xl font-bold'>
          Minato
        </Link>
        <div className='ml-auto flex items-center gap-2'>
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <div className='flex flex-1'>
        {/* Desktop sidebar rail */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r bg-muted/40 transition-[width] duration-200 md:flex',
            collapsed ? 'md:w-16' : 'md:w-64'
          )}
        >
          <div className='flex-1 overflow-y-auto'>
            <SidebarContent collapsed={collapsed} />
          </div>
          <div className='border-t p-2'>
            <Button
              variant='ghost'
              size='sm'
              className={cn('w-full', collapsed && 'justify-center px-0')}
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className='h-5 w-5' />
              ) : (
                <>
                  <PanelLeftClose className='h-5 w-5' />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className='fixed inset-0 z-40 md:hidden'>
            <button
              type='button'
              className='absolute inset-0 bg-black/50'
              onClick={() => setMobileOpen(false)}
              aria-label='Close menu'
            />
            <div className='animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-64 flex-col bg-background shadow-lg'>
              <div className='flex h-14 items-center justify-between border-b px-4'>
                <span className='text-lg font-bold'>Minato</span>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setMobileOpen(false)}
                  aria-label='Close menu'
                >
                  <X className='h-5 w-5' />
                </Button>
              </div>
              <div className='flex-1 overflow-y-auto'>
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        <main className='min-w-0 flex-1 p-4 md:p-6'>
          <Breadcrumbs />
          {children}
        </main>
      </div>

      <Footer />
    </div>
  )
}
