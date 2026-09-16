'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

import { SidebarNav } from '@/components/app-sidebar'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CommandPalette } from '@/components/command-palette'
import { NotificationBell } from '@/components/notification-bell'
import {
  isSidebarMode,
  SIDEBAR_MODE_STORAGE_KEY,
  SidebarControl,
  SidebarMode
} from '@/components/sidebar-control'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'

// Routes that never get the authenticated app shell (public / kiosk pages).
const PUBLIC_PREFIXES = ['/auth', '/signoff', '/shared', '/s/']

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  )
}

function BrandMark({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-tint text-sm font-semibold text-foreground',
        className
      )}
    >
      M
    </span>
  )
}

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
      <header className='flex h-12 items-center justify-between border-b px-4'>
        <Link href='/' className='flex items-center gap-2 font-semibold'>
          <BrandMark />
          Minato
        </Link>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          {session ? (
            <Button
              variant='surface'
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
  const [mode, setMode] = useState<SidebarMode>('hover')
  const [hovering, setHovering] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Restore the persisted sidebar behaviour.
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY)
    if (isSidebarMode(stored)) setMode(stored)
  }, [])

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

  const onModeChange = (next: SidebarMode) => {
    setMode(next)
    localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, next)
  }

  const expanded =
    mode === 'expanded' || (mode === 'hover' && (hovering || menuOpen))
  // Only the hover panel floats over the content; a pinned-open sidebar takes
  // up layout space so it never covers what you are reading.
  const overlaying = expanded && mode !== 'expanded'

  return (
    <TooltipProvider delayDuration={0}>
      <div className='flex h-screen overflow-hidden bg-background'>
        {/*
          The spacer holds the collapsed width in the layout so the panel can
          widen over the content on hover without anything reflowing.
        */}
        <div
          className={cn(
            'relative hidden shrink-0 transition-[width] duration-150 md:block',
            mode === 'expanded' ? 'w-56' : 'w-14'
          )}
        >
          <aside
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onFocus={() => setHovering(true)}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget)) return
              setHovering(false)
            }}
            className={cn(
              'absolute inset-y-0 left-0 z-40 flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150',
              expanded ? 'w-56' : 'w-14',
              overlaying && 'shadow-lg'
            )}
          >
            <div className='flex h-12 shrink-0 items-center gap-2 overflow-hidden px-[14px]'>
              <Link href='/' aria-label='Minato home'>
                <BrandMark />
              </Link>
              <span
                aria-hidden={!expanded}
                className={cn(
                  'whitespace-nowrap font-semibold transition-opacity duration-150',
                  expanded ? 'opacity-100' : 'opacity-0'
                )}
              >
                Minato
              </span>
            </div>

            <div className='flex-1 overflow-y-auto overflow-x-hidden'>
              <SidebarNav expanded={expanded} />
            </div>

            <div className='shrink-0 px-3 py-2'>
              <SidebarControl
                mode={mode}
                onModeChange={onModeChange}
                onOpenChange={setMenuOpen}
              />
            </div>
          </aside>
        </div>

        {/* Mobile drawer — always labelled, no hover affordance on touch */}
        {mobileOpen && (
          <div className='fixed inset-0 z-40 md:hidden'>
            <button
              type='button'
              className='absolute inset-0 bg-scrim'
              onClick={() => setMobileOpen(false)}
              aria-label='Close menu'
            />
            <div className='animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar shadow-lg'>
              <div className='flex h-12 items-center justify-between border-b border-sidebar-border px-3'>
                <span className='flex items-center gap-2 font-semibold'>
                  <BrandMark />
                  Minato
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setMobileOpen(false)}
                  aria-label='Close menu'
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
              <div className='flex-1 overflow-y-auto'>
                <SidebarNav expanded onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        <div className='flex min-w-0 flex-1 flex-col'>
          <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
            <Button
              variant='ghost'
              size='icon'
              className='md:hidden'
              onClick={() => setMobileOpen(true)}
              aria-label='Open menu'
            >
              <Menu className='h-4 w-4' />
            </Button>
            <Breadcrumbs />
            <div className='ml-auto flex items-center gap-2'>
              <CommandPalette />
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main className='min-w-0 flex-1 overflow-y-auto'>
            <div className='p-4 md:p-6'>{children}</div>
            <Footer />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
